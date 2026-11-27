"""Boundary condition and mock XML fixture tests for ISA atmosphere and RockSim .rse parsing."""

import pytest
from atmosphere_and_rse import isa_atmosphere, parse_rse_content


UNSORTED_AND_NEGATIVE_THRUST_RSE = """<?xml version="1.0" encoding="UTF-8"?>
<engine-database>
  <engine-list>
    <engine code="G80T" mfg="AeroTech" dia="29" len="124"
            delays="4,7,10" propWt="62.5" initWt="125.0">
      <data>
        <eng-data t="1.5" f="-2.5"/>
        <eng-data t="0.0" f="0.0"/>
        <eng-data f="45.0"/>
        <eng-data t="0.4" f="98.0"/>
      </data>
    </engine>
  </engine-list>
</engine-database>
"""


def test_isa_atmosphere_clamps_negative_altitude_to_sea_level():
    subzero = isa_atmosphere(-250.0)
    sea_level = isa_atmosphere(0.0)
    assert subzero.altitude_m == 0.0
    assert subzero == sea_level


def test_isa_atmosphere_tropopause_continuity_and_temperature_offset():
    just_below = isa_atmosphere(11000.0)
    just_above = isa_atmosphere(11000.5)
    assert just_below.temperature_k == pytest.approx(just_above.temperature_k, rel=1e-4)
    assert just_below.pressure_pa == pytest.approx(just_above.pressure_pa, rel=1e-3)
    assert just_below.air_density_kg_m3 == pytest.approx(just_above.air_density_kg_m3, rel=1e-3)

    # Hot-day launch decreases air density and raises speed of sound vs standard day
    hot_day = isa_atmosphere(0.0, sea_level_temp_c=38.0)
    std_day = isa_atmosphere(0.0, sea_level_temp_c=15.0)
    assert hot_day.air_density_kg_m3 < std_day.air_density_kg_m3
    assert hot_day.speed_of_sound_mps > std_day.speed_of_sound_mps
    assert hot_day.dynamic_viscosity_pa_s > std_day.dynamic_viscosity_pa_s


def test_isa_atmosphere_enforces_lower_temperature_floor_at_high_altitude():
    high_alt = isa_atmosphere(25000.0, sea_level_temp_c=-40.0)
    assert high_alt.temperature_k >= 180.0
    assert high_alt.pressure_pa > 0.0
    assert high_alt.air_density_kg_m3 > 0.0


def test_parse_rse_content_sorts_points_clamps_negative_thrust_and_skips_incomplete():
    motor = parse_rse_content(UNSORTED_AND_NEGATIVE_THRUST_RSE)
    times = [pt.time for pt in motor.data_points]
    thrusts = [pt.thrust for pt in motor.data_points]

    assert times == [0.0, 0.4, 1.5]
    assert thrusts == [0.0, 98.0, 0.0]
    assert motor.delays == "4,7,10"
    assert motor.propellant_mass_kg == pytest.approx(0.0625)
    assert motor.total_mass_kg == pytest.approx(0.125)


def test_parse_rse_content_rejects_malformed_xml_and_missing_samples():
    with pytest.raises(ValueError, match="Malformed .rse XML"):
        parse_rse_content("<engine-database><broken>")

    no_samples = """<engine-database><engine-list>
      <engine code="EMPTY" dia="29" len="100" propWt="10" initWt="20"><data/></engine>
    </engine-list></engine-database>"""
    with pytest.raises(ValueError, match="no <eng-data> thrust samples"):
        parse_rse_content(no_samples)
