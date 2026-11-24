"""Unit tests for US Standard Atmosphere 1976 model and RockSim .rse parser."""

import pytest
from atmosphere_and_rse import isa_atmosphere, parse_rse_content


SAMPLE_RSE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<engine-database>
  <engine-list>
    <engine code="F50T" mfg="AeroTech" dia="29." len="124."
            delays="4,6,9" propWt="37.4" initWt="81.0">
      <data>
        <eng-data t="0.0" f="0.0" m="37.4"/>
        <eng-data t="0.1" f="62.0" m="34.0"/>
        <eng-data t="0.8" f="52.0" m="12.0"/>
        <eng-data t="1.6" f="0.0" m="0.0"/>
      </data>
    </engine>
  </engine-list>
</engine-database>
"""


def test_isa_atmosphere_sea_level_reference():
    state = isa_atmosphere(0.0)
    assert state.temperature_k == pytest.approx(288.15, rel=1e-4)
    assert state.pressure_pa == pytest.approx(101325.0, rel=1e-4)
    assert state.air_density_kg_m3 == pytest.approx(1.225, abs=1e-3)
    assert state.speed_of_sound_mps == pytest.approx(340.29, abs=0.2)


def test_isa_atmosphere_decreases_density_with_altitude_and_crosses_tropopause():
    low = isa_atmosphere(500.0)
    mid = isa_atmosphere(5000.0)
    strat = isa_atmosphere(14000.0)

    assert low.air_density_kg_m3 > mid.air_density_kg_m3 > strat.air_density_kg_m3
    assert strat.temperature_k == pytest.approx(216.65, abs=0.1)


def test_parse_rse_content_extracts_motor_metadata_and_impulse():
    motor = parse_rse_content(SAMPLE_RSE_XML)
    assert motor.name == "F50T"
    assert motor.diameter_mm == pytest.approx(29.0)
    assert motor.propellant_mass_kg == pytest.approx(0.0374, abs=1e-5)
    assert motor.total_mass_kg == pytest.approx(0.081, abs=1e-5)
    assert motor.burn_time == pytest.approx(1.6)
    assert motor.total_impulse == pytest.approx(63.8, abs=0.5)
    assert motor.thrust_at(0.1) == pytest.approx(62.0)


def test_parse_rse_content_rejects_malformed_or_empty_xml():
    with pytest.raises(ValueError):
        parse_rse_content("")
    with pytest.raises(ValueError):
        parse_rse_content("<engine-database></engine-database>")
