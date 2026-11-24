"""US Standard Atmosphere 1976 model and RockSim (.rse) motor XML parser.

Extends Rocky's flight physics core with altitude-dependent air density / speed
of sound calculations and standard RockSim XML thrust-curve ingestion.
"""

from dataclasses import dataclass
import math
import xml.etree.ElementTree as ET
from typing import List

from rk4_physics import MotorThrustCurve, ThrustPoint

_G0 = 9.80665  # m/s^2
_R_AIR = 287.05287  # J/(kg*K)
_GAMMA = 1.4  # ratio of specific heats for dry air
_T0_SEA_LEVEL_K = 288.15  # 15 C
_P0_SEA_LEVEL_PA = 101325.0
_LAPSE_RATE = -0.0065  # K/m in troposphere (0 - 11,000 m)
_TROPOPAUSE_ALT_M = 11000.0


@dataclass(frozen=True)
class AtmosphericState:
    """Standard atmospheric state at a given geometric/geopotential altitude."""

    altitude_m: float
    temperature_k: float
    pressure_pa: float
    air_density_kg_m3: float
    speed_of_sound_mps: float
    dynamic_viscosity_pa_s: float


def isa_atmosphere(altitude_m: float, sea_level_temp_c: float = 15.0) -> AtmosphericState:
    """Computes US Standard Atmosphere 1976 properties up to 20 km AGL.

    Supports launch-day surface temperature offset while preserving the
    standard tropospheric lapse rate (-6.5 K/km) and isothermal lower stratosphere.
    """
    h = max(0.0, float(altitude_m))
    t0 = sea_level_temp_c + 273.15

    if h <= _TROPOPAUSE_ALT_M:
        temp_k = max(180.0, t0 + _LAPSE_RATE * h)
        exponent = -_G0 / (_LAPSE_RATE * _R_AIR)
        pressure_pa = _P0_SEA_LEVEL_PA * ((temp_k / t0) ** exponent)
    else:
        t_trop = max(180.0, t0 + _LAPSE_RATE * _TROPOPAUSE_ALT_M)
        exponent = -_G0 / (_LAPSE_RATE * _R_AIR)
        p_trop = _P0_SEA_LEVEL_PA * ((t_trop / t0) ** exponent)
        temp_k = t_trop
        pressure_pa = p_trop * math.exp(-_G0 * (h - _TROPOPAUSE_ALT_M) / (_R_AIR * temp_k))

    density = pressure_pa / (_R_AIR * temp_k)
    speed_of_sound = math.sqrt(_GAMMA * _R_AIR * temp_k)

    # Sutherland's formula for dynamic viscosity of air
    sutherland_c = 110.4
    mu0 = 1.716e-5
    t_ref = 273.15
    viscosity = mu0 * ((temp_k / t_ref) ** 1.5) * ((t_ref + sutherland_c) / (temp_k + sutherland_c))

    return AtmosphericState(
        altitude_m=h,
        temperature_k=temp_k,
        pressure_pa=pressure_pa,
        air_density_kg_m3=density,
        speed_of_sound_mps=speed_of_sound,
        dynamic_viscosity_pa_s=viscosity,
    )


def parse_rse_content(xml_content: str) -> MotorThrustCurve:
    """Parses a RockSim (.rse) XML motor definition into a MotorThrustCurve."""
    if not xml_content or not xml_content.strip():
        raise ValueError("Empty .rse XML content.")

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        raise ValueError(f"Malformed .rse XML: {exc}") from exc

    engine = root.find(".//engine")
    if engine is None:
        raise ValueError("Invalid .rse format: missing <engine> element.")

    name = engine.attrib.get("code", "UNKNOWN")
    diameter_mm = float(engine.attrib.get("dia", 0.0))
    length_mm = float(engine.attrib.get("len", 0.0))
    delays = engine.attrib.get("delays", "0")

    # RockSim stores propellant and initial weights in grams
    prop_mass_g = float(engine.attrib.get("propWt", 0.0))
    total_mass_g = float(engine.attrib.get("initWt", 0.0))

    points: List[ThrustPoint] = []
    for sample in engine.findall("./data/eng-data"):
        t_attr = sample.attrib.get("t")
        f_attr = sample.attrib.get("f")
        if t_attr is None or f_attr is None:
            continue
        points.append(ThrustPoint(time=float(t_attr), thrust=max(0.0, float(f_attr))))

    if not points:
        raise ValueError("Invalid .rse format: no <eng-data> thrust samples found.")

    points.sort(key=lambda pt: pt.time)

    return MotorThrustCurve(
        name=name,
        diameter_mm=diameter_mm,
        length_mm=length_mm,
        delays=delays,
        propellant_mass_kg=prop_mass_g / 1000.0,
        total_mass_kg=total_mass_g / 1000.0,
        data_points=points,
    )
