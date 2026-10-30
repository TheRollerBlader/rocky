"""Rocky 1 High-Power Rocketry 1D Flight Physics Simulation Engine (RK4 Integrator)
and Standard RockSim/RASP (.eng) Motor Thrust Curve Parser.

Built for the American Rocketry Challenge (ARC) flight envelope verification.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
import math


@dataclass
class ThrustPoint:
    time: float # seconds
    thrust: float # Newtons


@dataclass
class MotorThrustCurve:
    name: str
    diameter_mm: float
    length_mm: float
    delays: str
    propellant_mass_kg: float
    total_mass_kg: float
    data_points: List[ThrustPoint]

    @property
    def burn_time(self) -> float:
        return self.data_points[-1].time if self.data_points else 0.0

    @property
    def total_impulse(self) -> float:
        """Calculates total impulse (N*s) using trapezoidal numerical integration."""
        if len(self.data_points) < 2:
            return 0.0
        impulse = 0.0
        for i in range(len(self.data_points) - 1):
            dt = self.data_points[i + 1].time - self.data_points[i].time
            avg_thrust = (self.data_points[i].thrust + self.data_points[i + 1].thrust) / 2.0
            impulse += avg_thrust * dt
        return impulse

    def thrust_at(self, t: float) -> float:
        """Linear interpolation of thrust at time t."""
        if not self.data_points or t < 0 or t > self.burn_time:
            return 0.0
        for i in range(len(self.data_points) - 1):
            t0, f0 = self.data_points[i].time, self.data_points[i].thrust
            t1, f1 = self.data_points[i + 1].time, self.data_points[i + 1].thrust
            if t0 <= t <= t1:
                if t1 == t0:
                    return f0
                fraction = (t - t0) / (t1 - t0)
                return f0 + fraction * (f1 - f0)
        return 0.0


def parse_eng_content(content: str) -> MotorThrustCurve:
    """Parses standard RASP (.eng) motor file content."""
    lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    header_line = None
    data_points: List[ThrustPoint] = []

    for line in lines:
        if line.startswith(";"):
            continue
        if header_line is None:
            header_line = line
            continue
        parts = line.split()
        if len(parts) >= 2:
            try:
                t = float(parts[0])
                f = float(parts[1])
                data_points.append(ThrustPoint(time=t, thrust=f))
            except ValueError:
                continue

    if not header_line:
        raise ValueError("Invalid .eng format: missing motor specification line.")

    header_parts = header_line.split()
    if len(header_parts) < 7:
        raise ValueError(f"Invalid motor header: expected >= 7 tokens, got {len(header_parts)}")

    name = header_parts[0]
    diameter_mm = float(header_parts[1])
    length_mm = float(header_parts[2])
    delays = header_parts[3]
    propellant_mass_kg = float(header_parts[4])
    total_mass_kg = float(header_parts[5])

    return MotorThrustCurve(
        name=name,
        diameter_mm=diameter_mm,
        length_mm=length_mm,
        delays=delays,
        propellant_mass_kg=propellant_mass_kg,
        total_mass_kg=total_mass_kg,
        data_points=data_points,
    )


@dataclass
class RocketParameters:
    dry_mass_kg: float
    cross_section_area_m2: float
    cd_power: float = 0.45
    cd_coast: float = 0.42
    parachute_area_m2: float = 0.25 # Main parachute area
    parachute_cd: float = 1.5
    main_deploy_altitude_m: float = 120.0 # meters AGL
    air_density: float = 1.225 # kg/m^3 (sea-level standard)
    gravity: float = 9.80665


@dataclass
class FlightSummary:
    apogee_altitude_m: float
    time_to_apogee_s: float
    max_velocity_mps: float
    total_flight_time_s: float
    landing_velocity_mps: float


def simulate_rocket_flight(
    rocket: RocketParameters,
    motor: MotorThrustCurve,
    dt: float = 0.01,
    max_time: float = 120.0,
) -> FlightSummary:
    """Simulates 1D vertical trajectory using 4th-order Runge-Kutta (RK4) integration."""
    t = 0.0
    y = 0.0 # altitude (m)
    v = 0.0 # velocity (m/s)

    apogee_alt = 0.0
    time_to_apogee = 0.0
    max_v = 0.0
    apogee_reached = False
    chute_deployed = False

    burn_time = motor.burn_time
    total_prop_mass = motor.propellant_mass_kg
    total_initial_mass = rocket.dry_mass_kg + motor.total_mass_kg
    motor_casing_mass = motor.total_mass_kg - motor.propellant_mass_kg

    def get_mass(curr_t: float) -> float:
        if curr_t < burn_time and burn_time > 0:
            burned_ratio = curr_t / burn_time
            curr_prop = total_prop_mass * (1.0 - burned_ratio)
            return rocket.dry_mass_kg + motor_casing_mass + curr_prop
        return rocket.dry_mass_kg + motor_casing_mass

    def get_acceleration(curr_t: float, curr_y: float, curr_v: float) -> float:
        nonlocal chute_deployed
        m = get_mass(curr_t)
        thrust = motor.thrust_at(curr_t)

        if not apogee_reached:
            cd = rocket.cd_power if thrust > 0 else rocket.cd_coast
            area = rocket.cross_section_area_m2
        else:
            if curr_y <= rocket.main_deploy_altitude_m or chute_deployed:
                chute_deployed = True
                cd = rocket.parachute_cd
                area = rocket.parachute_area_m2
            else:
                cd = 1.2
                area = rocket.cross_section_area_m2 * 1.5 # Drogue / tumbling body

        drag = 0.5 * rocket.air_density * (curr_v ** 2) * cd * area
        # Drag always opposes direction of motion
        drag_force = -drag if curr_v >= 0 else drag

        net_force = thrust + drag_force - (m * rocket.gravity)
        return net_force / m

    # Time integration loop
    while t < max_time:
        # Check apogee
        if not apogee_reached and v < 0 and y > 0:
            apogee_reached = True
            apogee_alt = y
            time_to_apogee = t

        if v > max_v:
            max_v = v

        # Check ground landing after apogee
        if apogee_reached and y <= 0.0 and t > 1.0:
            return FlightSummary(
                apogee_altitude_m=apogee_alt,
                time_to_apogee_s=time_to_apogee,
                max_velocity_mps=max_v,
                total_flight_time_s=t,
                landing_velocity_mps=abs(v),
            )

        # RK4 step for y and v
        # k1
        k1_v = get_acceleration(t, y, v)
        k1_y = v

        # k2
        t_half = t + 0.5 * dt
        y_k2 = y + 0.5 * dt * k1_y
        v_k2 = v + 0.5 * dt * k1_v
        k2_v = get_acceleration(t_half, y_k2, v_k2)
        k2_y = v_k2

        # k3
        y_k3 = y + 0.5 * dt * k2_y
        v_k3 = v + 0.5 * dt * k2_v
        k3_v = get_acceleration(t_half, y_k3, v_k3)
        k3_y = v_k3

        # k4
        t_full = t + dt
        y_k4 = y + dt * k3_y
        v_k4 = v + dt * k3_v
        k4_v = get_acceleration(t_full, y_k4, v_k4)
        k4_y = v_k4

        # Update state
        y += (dt / 6.0) * (k1_y + 2.0 * k2_y + 2.0 * k3_y + k4_y)
        v += (dt / 6.0) * (k1_v + 2.0 * k2_v + 2.0 * k3_v + k4_v)
        t += dt

    return FlightSummary(
        apogee_altitude_m=apogee_alt if apogee_reached else y,
        time_to_apogee_s=time_to_apogee,
        max_velocity_mps=max_v,
        total_flight_time_s=t,
        landing_velocity_mps=abs(v),
    )
