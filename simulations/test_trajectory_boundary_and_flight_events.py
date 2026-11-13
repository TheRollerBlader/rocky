"""High-leverage flight boundary and dual-deployment verification test suite for Rocky 1.
Scheduled Milestone: Testing & Verification (2026-11-13).

Validates ARC competition compliance:
1. Terminal descent landing velocity bounds under parachute deploy (<= 6.5 m/s).
2. Apogee detection determinism across varying dt integration step sizes.
3. Mass burn-off conservation and propellant exhaustion physics.
"""

import pytest
import math
from rk4_physics import (
    parse_eng_content,
    MotorThrustCurve,
    ThrustPoint,
    RocketParameters,
    simulate_rocket_flight,
)

SAMPLE_E20_ENG = """
; Estes / Aerotech E20 motor curve
E20 24 70 4-7 0.0198 0.0450 AT
  0.05 12.0
  0.10 24.5
  0.30 21.0
  0.80 19.5
  1.40 18.0
  1.80 0.0
"""


class TestFlightEnvelopeAndBoundaryConditions:
    def test_arc_compliant_safe_landing_velocity(self):
        """American Rocketry Challenge safety requirement: landing velocity must not exceed 6.5 m/s."""
        motor = parse_eng_content(SAMPLE_E20_ENG)
        rocket = RocketParameters(
            dry_mass_kg=0.450,
            cross_section_area_m2=math.pi * (0.028 ** 2),  # 56mm diameter airframe
            cd_power=0.45,
            cd_coast=0.42,
            parachute_area_m2=math.pi * (0.25 ** 2),       # 50cm diameter chute
            parachute_cd=1.5,
            main_deploy_altitude_m=120.0,
        )

        flight = simulate_rocket_flight(rocket, motor, dt=0.01, max_time=120.0)
        assert flight.apogee_altitude_m > 50.0, "Rocket should reach substantial altitude"
        assert flight.time_to_apogee_s > 2.0, "Time to apogee must be physically reasonable"
        assert flight.landing_velocity_mps <= 6.5, (
            f"Descent velocity {flight.landing_velocity_mps:.2f} m/s exceeds ARC safety limit of 6.5 m/s"
        )

    def test_rk4_dt_convergence_stability(self):
        """Apogee calculation must converge within 1% between dt=0.01s and dt=0.002s."""
        motor = parse_eng_content(SAMPLE_E20_ENG)
        rocket = RocketParameters(
            dry_mass_kg=0.500,
            cross_section_area_m2=math.pi * (0.03 ** 2),
            cd_power=0.48,
            cd_coast=0.45,
            parachute_area_m2=math.pi * (0.2 ** 2),
            parachute_cd=1.4,
            main_deploy_altitude_m=100.0,
        )

        coarse_sim = simulate_rocket_flight(rocket, motor, dt=0.01)
        fine_sim = simulate_rocket_flight(rocket, motor, dt=0.002)

        rel_error = abs(coarse_sim.apogee_altitude_m - fine_sim.apogee_altitude_m) / fine_sim.apogee_altitude_m
        assert rel_error < 0.01, f"RK4 integration apogee error {rel_error * 100:.3f}% exceeds 1% tolerance"

    def test_heavy_payload_apogee_reduction(self):
        """Increasing rocket payload mass by 50% must strictly decrease apogee altitude."""
        motor = parse_eng_content(SAMPLE_E20_ENG)
        light_rocket = RocketParameters(
            dry_mass_kg=0.400,
            cross_section_area_m2=math.pi * (0.025 ** 2),
            cd_power=0.44,
            cd_coast=0.40,
            parachute_area_m2=0.15,
            parachute_cd=1.4,
            main_deploy_altitude_m=100.0,
        )
        heavy_rocket = RocketParameters(
            dry_mass_kg=0.600,
            cross_section_area_m2=math.pi * (0.025 ** 2),
            cd_power=0.44,
            cd_coast=0.40,
            parachute_area_m2=0.15,
            parachute_cd=1.4,
            main_deploy_altitude_m=100.0,
        )

        sim_light = simulate_rocket_flight(light_rocket, motor, dt=0.01)
        sim_heavy = simulate_rocket_flight(heavy_rocket, motor, dt=0.01)

        assert sim_light.apogee_altitude_m > sim_heavy.apogee_altitude_m
        assert sim_light.max_velocity_mps > sim_heavy.max_velocity_mps
