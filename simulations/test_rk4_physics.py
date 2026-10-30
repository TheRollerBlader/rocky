import pytest
from rk4_physics import (
    parse_eng_content,
    MotorThrustCurve,
    ThrustPoint,
    RocketParameters,
    simulate_rocket_flight,
)

SAMPLE_ENG_FILE = """
; Aerotech F32 Motor Thrust Data
; Source: thrustcurve.org
F32 29 124 6-10-14 0.0358 0.0825 AT
  0.034 18.2
  0.071 35.8
  0.150 42.1
  0.400 34.0
  0.800 31.5
  1.200 30.1
  1.500 0.0
"""


class TestRockyPhysics:
    def test_parse_eng_file(self):
        motor = parse_eng_content(SAMPLE_ENG_FILE)
        assert motor.name == "F32"
        assert motor.diameter_mm == 29.0
        assert motor.length_mm == 124.0
        assert motor.propellant_mass_kg == 0.0358
        assert motor.total_mass_kg == 0.0825
        assert len(motor.data_points) == 7
        assert motor.burn_time == 1.5

    def test_total_impulse_calculation(self):
        motor = parse_eng_content(SAMPLE_ENG_FILE)
        impulse = motor.total_impulse
        # F-class motor impulse is between 40.01 and 80.0 N*s
        assert 40.0 <= impulse <= 60.0

    def test_thrust_linear_interpolation(self):
        motor = parse_eng_content(SAMPLE_ENG_FILE)
        assert motor.thrust_at(0.0) == 0.0
        # Between 0.034s (18.2N) and 0.071s (35.8N)
        mid_thrust = motor.thrust_at((0.034 + 0.071) / 2)
        assert pytest.approx(mid_thrust, abs=0.1) == (18.2 + 35.8) / 2
        # Beyond burn time
        assert motor.thrust_at(2.0) == 0.0

    def test_rk4_flight_simulation_apogee_and_landing(self):
        motor = parse_eng_content(SAMPLE_ENG_FILE)
        # Rocky ARC rocket configuration (~550g dry mass, 56mm airframe)
        rocket = RocketParameters(
            dry_mass_kg=0.550,
            cross_section_area_m2=3.14159 * (0.056 / 2) ** 2,
            cd_power=0.45,
            cd_coast=0.42,
            parachute_area_m2=0.25,
            parachute_cd=1.5,
            main_deploy_altitude_m=120.0,
        )

        flight = simulate_rocket_flight(rocket, motor, dt=0.01)

        # Expected ARC F-motor apogee between 150m and 350m
        assert 150.0 <= flight.apogee_altitude_m <= 350.0
        # Max velocity should be realistic subsonic (30 - 90 m/s)
        assert 30.0 <= flight.max_velocity_mps <= 90.0
        # Flight time should be > 20s
        assert flight.total_flight_time_s >= 20.0
        # Safe parachute landing velocity should be < 7 m/s
        assert flight.landing_velocity_mps <= 7.0
