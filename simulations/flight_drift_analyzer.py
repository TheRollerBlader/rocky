"""High-altitude wind shear profile, lateral drift integration, and ARC launch field
boundary verification for Rocky 1.

Implements Saturday: Type Safety, Linting & Polish for Month 5 Aerospace Simulation Roadmap.
"""

from dataclasses import dataclass
from typing import List, Tuple, Optional
import math


@dataclass
class WindShearProfile:
    """Atmospheric surface boundary layer wind shear profile using Hellmann power law."""
    surface_wind_mps: float # v0 at 10m standard anemometer height
    reference_height_m: float = 10.0
    shear_exponent: float = 0.143 # 1/7 power law for open rural terrain
    gust_factor: float = 1.25

    def wind_speed_at_altitude(self, altitude_m: float) -> float:
        """Calculates horizontal wind speed (m/s) at given altitude AGL."""
        clamped_z = max(1.0, altitude_m)
        base_speed = self.surface_wind_mps * ((clamped_z / self.reference_height_m) ** self.shear_exponent)
        return float(base_speed)

    def gust_speed_at_altitude(self, altitude_m: float) -> float:
        return self.wind_speed_at_altitude(altitude_m) * self.gust_factor


@dataclass
class LateralDriftSummary:
    """Trajectory lateral displacement and landing zone radius."""
    total_drift_m: float
    drogue_phase_drift_m: float
    main_phase_drift_m: float
    estimated_bearing_deg: float
    is_within_field_perimeter: bool
    field_radius_limit_m: float


def compute_lateral_descent_drift(
    apogee_altitude_m: float,
    main_deploy_altitude_m: float,
    drogue_descent_rate_mps: float,
    main_descent_rate_mps: float,
    wind_profile: WindShearProfile,
    field_radius_limit_m: float = 400.0,
    wind_bearing_deg: float = 0.0,
    num_integration_steps: int = 100,
) -> LateralDriftSummary:
    """Integrates horizontal displacement across descending altitude slices.

    Assumes descending rocket reaches terminal horizontal drift velocity equal
    to ambient local wind speed.
    """
    if apogee_altitude_m <= 0:
        return LateralDriftSummary(
            total_drift_m=0.0,
            drogue_phase_drift_m=0.0,
            main_phase_drift_m=0.0,
            estimated_bearing_deg=wind_bearing_deg,
            is_within_field_perimeter=True,
            field_radius_limit_m=field_radius_limit_m,
        )

    # 1. Drogue descent phase: from apogee down to main_deploy_altitude_m
    drogue_alt_start = max(apogee_altitude_m, main_deploy_altitude_m)
    drogue_alt_end = min(apogee_altitude_m, main_deploy_altitude_m)
    drogue_drift = 0.0

    if drogue_alt_start > drogue_alt_end and drogue_descent_rate_mps > 0:
        dz = (drogue_alt_start - drogue_alt_end) / num_integration_steps
        dt_step = dz / drogue_descent_rate_mps
        for i in range(num_integration_steps):
            z = drogue_alt_end + (i + 0.5) * dz
            w = wind_profile.wind_speed_at_altitude(z)
            drogue_drift += w * dt_step

    # 2. Main parachute descent phase: from main_deploy_altitude_m down to 0
    main_drift = 0.0
    if drogue_alt_end > 0 and main_descent_rate_mps > 0:
        dz = drogue_alt_end / num_integration_steps
        dt_step = dz / main_descent_rate_mps
        for i in range(num_integration_steps):
            z = (i + 0.5) * dz
            w = wind_profile.wind_speed_at_altitude(z)
            main_drift += w * dt_step

    total_drift = drogue_drift + main_drift
    is_within = total_drift <= field_radius_limit_m

    return LateralDriftSummary(
        total_drift_m=round(total_drift, 2),
        drogue_phase_drift_m=round(drogue_drift, 2),
        main_phase_drift_m=round(main_drift, 2),
        estimated_bearing_deg=wind_bearing_deg % 360.0,
        is_within_field_perimeter=is_within,
        field_radius_limit_m=field_radius_limit_m,
    )
