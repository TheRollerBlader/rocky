import pytest
from telemetry_decoder import (
    TelemetryStreamDecoder,
    TelemetryPacket,
    FlightPhase,
    calculate_pressure_altitude_m,
    compute_xor_checksum,
    compute_crc16_ccitt,
)


class TestTelemetryDecoder:
    def test_pressure_altitude_conversion(self):
        # Sea level pressure should yield 0m
        assert pytest.approx(calculate_pressure_altitude_m(1013.25, sea_level_hpa=1013.25), abs=0.1) == 0.0
        # Standard pressure at 1000m is ~898.7 hPa
        alt_1000 = calculate_pressure_altitude_m(898.7, sea_level_hpa=1013.25)
        assert pytest.approx(alt_1000, abs=10.0) == 1000.0

    def test_checksum_computation(self):
        sentence = "ROCKY,0.50,1013.25,0.02,7.4,22.0"
        ck = compute_xor_checksum(sentence)
        assert len(ck) == 2
        # Precomputed verification
        assert compute_xor_checksum("TEST") == "16"

    def test_crc16_ccitt(self):
        crc = compute_crc16_ccitt(b"123456789")
        assert crc == 0x29B1

    def test_parse_valid_sentence(self):
        decoder = TelemetryStreamDecoder(ground_elevation_m=0.0, sea_level_hpa=1013.25)
        raw_payload = "ROCKY,0.00,1013.25,0.00,7.4,21.5"
        checksum = compute_xor_checksum(raw_payload)
        sentence = f"${raw_payload}*{checksum}\n"

        packets = decoder.feed(sentence)
        assert len(packets) == 1
        p = packets[0]
        assert p.timestamp_s == 0.0
        assert p.pressure_hpa == 1013.25
        assert p.battery_voltage_v == 7.4
        assert p.phase == FlightPhase.PAD_IDLE

    def test_corrupt_checksum_rejected(self):
        decoder = TelemetryStreamDecoder()
        bad_sentence = "$ROCKY,1.00,1000.0,3.0,7.2,22.0*00\n"
        packets = decoder.feed(bad_sentence)
        assert len(packets) == 0

    def test_fragmented_stream_reassembly(self):
        decoder = TelemetryStreamDecoder()
        payload = "ROCKY,0.10,1010.00,1.20,7.4,20.0"
        ck = compute_xor_checksum(payload)
        full = f"${payload}*{ck}\n"

        # Split across two fragmented incoming chunks
        chunk1 = full[:10]
        chunk2 = full[10:]

        assert len(decoder.feed(chunk1)) == 0
        packets = decoder.feed(chunk2)
        assert len(packets) == 1
        assert packets[0].timestamp_s == 0.10

    def test_flight_phase_transition_sequence(self):
        decoder = TelemetryStreamDecoder(ground_elevation_m=0.0, sea_level_hpa=1013.25)

        # 1. Boost phase: high accel (5g) and climbing
        p1 = "ROCKY,0.50,980.00,5.20,7.3,23.0"
        packets1 = decoder.feed(f"${p1}*{compute_xor_checksum(p1)}\n")
        assert packets1[0].phase == FlightPhase.POWERED_FLIGHT

        # 2. Coast phase: burn out (0.1g) but high upward velocity
        p2 = "ROCKY,1.50,950.00,0.05,7.3,23.1"
        packets2 = decoder.feed(f"${p2}*{compute_xor_checksum(p2)}\n")
        assert packets2[0].phase in (FlightPhase.COASTING, FlightPhase.POWERED_FLIGHT)

        # 3. Apogee: top of trajectory
        p3 = "ROCKY,3.00,920.00,-0.10,7.3,23.2"
        decoder.feed(f"${p3}*{compute_xor_checksum(p3)}\n")
        p4 = "ROCKY,3.50,921.00,-0.10,7.3,23.2"
        packets4 = decoder.feed(f"${p4}*{compute_xor_checksum(p4)}\n")
        assert packets4[0].phase == FlightPhase.APOGEE
