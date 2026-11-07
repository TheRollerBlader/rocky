"""Strict typed telemetry schema and sensor health validation for Rocky 1 flight computers.

Implements Week 1 Milestone: Saturday - Type Safety, Linting & Polish.
"""

from enum import Enum
from typing import Dict, Any, List, Optional
import math
import numpy as np
from pydantic import BaseModel, Field, field_validator, model_validator


class FlightPhaseEnum(str, Enum):
    PAD_IDLE = "PAD_IDLE"
    POWERED_FLIGHT = "POWERED_FLIGHT"
    COASTING = "COASTING"
    APOGEE = "APOGEE"
    DROGUE_DESCENT = "DROGUE_DESCENT"
    MAIN_DESCENT = "MAIN_DESCENT"
    LANDED = "LANDED"


class SensorHealthStatus(str, Enum):
    NOMINAL = "NOMINAL"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class CalibratedSensorFrame(BaseModel):
    """Validated avionics telemetry packet from flight computer BMP388 / IMU sensors."""
    timestamp_s: float = Field(..., ge=0.0, description="Flight computer uptime in seconds")
    pressure_hpa: float = Field(..., ge=200.0, le=1200.0, description="Barometric pressure in hectopascals")
    altitude_m: float = Field(..., ge=-100.0, le=10000.0, description="Barometric altitude in meters above sea level")
    vertical_velocity_mps: float = Field(..., ge=-300.0, le=500.0, description="Ascent/descent velocity in m/s")
    vertical_accel_g: float = Field(..., ge=-25.0, le=60.0, description="Axial acceleration in g-units")
    battery_voltage_v: float = Field(..., ge=2.8, le=14.0, description="Avionics LiPo battery voltage in Volts")
    temperature_c: float = Field(..., ge=-40.0, le=85.0, description="Internal bay temperature in Celsius")
    phase: FlightPhaseEnum = Field(default=FlightPhaseEnum.PAD_IDLE, description="Estimated flight phase")

    @field_validator("pressure_hpa", "altitude_m", "vertical_velocity_mps", "vertical_accel_g", "battery_voltage_v")
    @classmethod
    def validate_finite_numbers(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Telemetry readings must be finite floating point numbers")
        return float(v)

    @model_validator(mode="after")
    def validate_kinematic_consistency(self) -> "CalibratedSensorFrame":
        """Asserts physical realism between phase and vertical velocity."""
        if self.phase in (FlightPhaseEnum.DROGUE_DESCENT, FlightPhaseEnum.MAIN_DESCENT):
            if self.vertical_velocity_mps > 5.0:
                # Under parachute descent, velocity should generally be negative or near zero
                raise ValueError(
                    f"Kinematic mismatch: phase is {self.phase.value} but vertical velocity is {self.vertical_velocity_mps} m/s"
                )
        return self


class AvionicsHealthReport(BaseModel):
    """Avionics bus diagnostic summary."""
    status: SensorHealthStatus
    battery_level_percent: float = Field(..., ge=0.0, le=100.0)
    pressure_sensor_ok: bool
    temperature_ok: bool
    warnings: List[str] = Field(default_factory=list)


def evaluate_avionics_health(frame: CalibratedSensorFrame) -> AvionicsHealthReport:
    """Diagnoses flight computer bus health from a calibrated telemetry frame."""
    warnings: List[str] = []

    # LiPo 1S or 2S battery checks (assuming 1S nominal 3.7V - 4.2V, cut-off at 3.3V)
    if frame.battery_voltage_v < 3.4:
        warnings.append(f"Low battery voltage: {frame.battery_voltage_v:.2f}V (under 3.4V threshold)")
        status = SensorHealthStatus.CRITICAL
    elif frame.battery_voltage_v < 3.6:
        warnings.append(f"Marginal battery voltage: {frame.battery_voltage_v:.2f}V")
        status = SensorHealthStatus.WARNING
    else:
        status = SensorHealthStatus.NOMINAL

    # Temperature checks
    temp_ok = (-10.0 <= frame.temperature_c <= 65.0)
    if not temp_ok:
        warnings.append(f"Temperature excursion: {frame.temperature_c:.1f}°C outside safe operating range")
        if status != SensorHealthStatus.CRITICAL:
            status = SensorHealthStatus.WARNING

    # Battery percentage calculation (3.3V = 0%, 4.2V = 100% for 1S cell)
    pct = max(0.0, min(100.0, ((frame.battery_voltage_v - 3.3) / (4.2 - 3.3)) * 100.0))

    return AvionicsHealthReport(
        status=status,
        battery_level_percent=round(pct, 1),
        pressure_sensor_ok=True,
        temperature_ok=temp_ok,
        warnings=warnings,
    )
