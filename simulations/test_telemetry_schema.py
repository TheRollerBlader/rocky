"""Tests for Rocky 1 Typed Telemetry Schemas, Range Checks, and Avionics Health."""

import pytest
import math
from pydantic import ValidationError
from telemetry_schema import (
    CalibratedSensorFrame,
    FlightPhaseEnum,
    SensorHealthStatus,
    evaluate_avionics_health,
)


class TestTelemetrySchema:
    def test_nominal_telemetry_frame(self):
        frame = CalibratedSensorFrame(
            timestamp_s=12.45,
            pressure_hpa=1010.5,
            altitude_m=24.3,
            vertical_velocity_mps=15.2,
            vertical_accel_g=3.8,
            battery_voltage_v=4.05,
            temperature_c=22.4,
            phase=FlightPhaseEnum.POWERED_FLIGHT,
        )
        assert frame.timestamp_s == 12.45
        assert frame.phase == FlightPhaseEnum.POWERED_FLIGHT

        health = evaluate_avionics_health(frame)
        assert health.status == SensorHealthStatus.NOMINAL
        assert health.battery_level_percent > 80.0
        assert health.temperature_ok is True
        assert len(health.warnings) == 0

    def test_rejects_nan_readings(self):
        with pytest.raises(ValidationError):
            CalibratedSensorFrame(
                timestamp_s=1.0,
                pressure_hpa=float("nan"),
                altitude_m=0.0,
                vertical_velocity_mps=0.0,
                vertical_accel_g=1.0,
                battery_voltage_v=3.8,
                temperature_c=20.0,
            )

    def test_rejects_unphysical_descent_velocity(self):
        # Drogue descent cannot have positive climbing velocity of 50 m/s
        with pytest.raises(ValidationError) as excinfo:
            CalibratedSensorFrame(
                timestamp_s=25.0,
                pressure_hpa=950.0,
                altitude_m=250.0,
                vertical_velocity_mps=50.0,
                vertical_accel_g=-0.2,
                battery_voltage_v=3.9,
                temperature_c=20.0,
                phase=FlightPhaseEnum.DROGUE_DESCENT,
            )
        assert "Kinematic mismatch" in str(excinfo.value)

    def test_avionics_health_low_voltage_warning(self):
        frame = CalibratedSensorFrame(
            timestamp_s=50.0,
            pressure_hpa=1013.0,
            altitude_m=0.5,
            vertical_velocity_mps=0.0,
            vertical_accel_g=1.0,
            battery_voltage_v=3.25,
            temperature_c=25.0,
            phase=FlightPhaseEnum.LANDED,
        )
        health = evaluate_avionics_health(frame)
        assert health.status == SensorHealthStatus.CRITICAL
        assert any("Low battery" in w for w in health.warnings)
