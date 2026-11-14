"""Test suite for Rocky 1 lateral wind drift integration and ARC field perimeter verification.
"""

import pytest
from flight_drift_analyzer import (
    WindShearProfile,
    LateralDriftSummary,
    compute_lateral_descent_drift,
)


class TestFlightDriftAnalyzer:
    def test_wind_shear_profile_calculation(self):
        # 5 m/s at 10m reference height
        profile = WindShearProfile(surface_wind_mps=5.0, reference_height_m=10.0, shear_exponent=0.143)
        assert abs(profile.wind_speed_at_altitude(10.0) - 5.0) < 1e-4
        # Higher altitude should experience higher wind speed
        assert profile.wind_speed_at_altitude(250.0) > 5.0
        # Gust factor scaling
        assert profile.gust_speed_at_altitude(10.0) == 5.0 * 1.25

    def test_zero_wind_produces_zero_drift(self):
        profile = WindShearProfile(surface_wind_mps=0.0)
        drift = compute_lateral_descent_drift(
            apogee_altitude_m=250.0,
            main_deploy_altitude_m=100.0,
            drogue_descent_rate_mps=18.0,
            main_descent_rate_mps=4.5,
            wind_profile=profile,
        )
        assert drift.total_drift_m == 0.0
        assert drift.is_within_field_perimeter is True

    def test_nominal_arc_descent_drift_within_perimeter(self):
        # Typical ARC profile: 250m apogee, main deploy at 100m, 4.0 m/s surface wind
        profile = WindShearProfile(surface_wind_mps=4.0)
        drift = compute_lateral_descent_drift(
            apogee_altitude_m=250.0,
            main_deploy_altitude_m=100.0,
            drogue_descent_rate_mps=15.0,
            main_descent_rate_mps=4.5,
            wind_profile=profile,
            field_radius_limit_m=400.0,
        )
        # Main chute descent duration is ~100m / 4.5m/s = ~22s
        # Total drift should be substantial (~100-200m) but well within 400m perimeter
        assert 50.0 < drift.total_drift_m < 300.0
        assert drift.is_within_field_perimeter is True
        assert drift.drogue_phase_drift_m > 0
        assert drift.main_phase_drift_m > 0

    def test_gale_force_winds_trigger_out_of_bounds_alert(self):
        # 16 m/s (~35 mph) severe wind
        profile = WindShearProfile(surface_wind_mps=16.0)
        drift = compute_lateral_descent_drift(
            apogee_altitude_m=300.0,
            main_deploy_altitude_m=150.0,
            drogue_descent_rate_mps=10.0,
            main_descent_rate_mps=3.5,
            wind_profile=profile,
            field_radius_limit_m=300.0,
        )
        assert drift.total_drift_m > 300.0
        assert drift.is_within_field_perimeter is False
