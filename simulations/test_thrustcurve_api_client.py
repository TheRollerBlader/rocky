import pytest
from thrustcurve_api_client import ThrustCurveAPIClient, MotorSummary


class TestThrustCurveAPIClient:
    def test_impulse_classification(self):
        client = ThrustCurveAPIClient(enable_cache=False)
        assert client.classify_impulse(2.0) == "A"
        assert client.classify_impulse(8.5) == "C"
        assert client.classify_impulse(35.0) == "E"
        assert client.classify_impulse(72.0) == "F"
        assert client.classify_impulse(120.0) == "G"

    def test_parse_search_results(self):
        client = ThrustCurveAPIClient(enable_cache=False)
        mock_payload = {
            "results": [
                {
                    "motorId": "104",
                    "manufacturer": "Cesaroni",
                    "commonName": "F39",
                    "impulseClass": "F",
                    "totImpulseNs": 75.4,
                    "avgThrustN": 39.2,
                    "maxThrustN": 52.1,
                    "burnTimeS": 1.92,
                    "propWeightG": 38.5,
                    "totalWeightG": 92.0,
                    "diameter": 29.0,
                    "length": 124.0,
                }
            ]
        }

        summaries = client.parse_search_results(mock_payload)
        assert len(summaries) == 1
        m = summaries[0]
        assert m.manufacturer == "Cesaroni"
        assert m.common_name == "F39"
        assert m.impulse_class == "F"
        assert m.total_impulse_ns == 75.4
        assert m.burn_time_sec == 1.92

    def test_parse_rasp_eng_text(self):
        client = ThrustCurveAPIClient(enable_cache=False)
        sample_eng = """
; Sample RASP curve for ARC qualification
F39 29.0 124.0 6-9-12 0.0385 0.0920 Cesaroni
0.05 12.0
0.10 45.0
0.20 52.0
0.50 48.0
1.00 40.0
1.50 35.0
1.90 0.0
"""
        parsed = client.parse_rasp_eng_text(sample_eng)
        assert parsed["name"] == "F39"
        assert parsed["manufacturer"] == "Cesaroni"
        assert parsed["diameter_mm"] == 29.0
        assert parsed["length_mm"] == 124.0
        assert parsed["burn_time_sec"] == 1.90
        assert parsed["impulse_class"] == "F"
        assert parsed["max_thrust_n"] == 52.0
        assert len(parsed["curve_points"]) == 7
