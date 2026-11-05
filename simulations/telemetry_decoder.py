"""Rocky 1 Altimeter & Flight Computer Telemetry Ingestion and Stream Decoder.

Built for the American Rocketry Challenge (ARC).
Decodes live telemetry streams from flight altimeters (e.g., Altus Metrum,
PerfectFlite, and ESP32/BMP388 custom serial avionics) over USB/UART.
Provides CRC/XOR checksum verification, pressure-to-altitude hypsometric conversion,
and real-time flight phase state estimation.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from enum import Enum
from typing import List, Optional, Tuple, Dict, Any
import math


class FlightPhase(str, Enum):
    PAD_IDLE = "PAD_IDLE"
    POWERED_FLIGHT = "POWERED_FLIGHT"
    COASTING = "COASTING"
    APOGEE = "APOGEE"
    DROGUE_DESCENT = "DROGUE_DESCENT"
    MAIN_DESCENT = "MAIN_DESCENT"
    LANDED = "LANDED"


@dataclass
class TelemetryPacket:
    timestamp_s: float
    pressure_hpa: float
    altitude_m: float
    vertical_velocity_mps: float
    vertical_accel_g: float
    battery_voltage_v: float
    temperature_c: float
    phase: FlightPhase
    raw_sentence: str

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["phase"] = self.phase.value
        return d


def calculate_pressure_altitude_m(pressure_hpa: float, sea_level_hpa: float = 1013.25) -> float:
    """Standard ISA barometric formula for tropospheric pressure altitude.
    h = 44330 * (1 - (P / P0) ^ (1 / 5.255))
    """
    if pressure_hpa <= 0:
        return 0.0
    pressure_ratio = pressure_hpa / sea_level_hpa
    if pressure_ratio <= 0:
        return 0.0
    return 44330.0 * (1.0 - math.pow(pressure_ratio, 1.0 / 5.2558))


def compute_xor_checksum(sentence: str) -> str:
    """Computes standard 2-character hexadecimal NMEA-style XOR checksum."""
    checksum = 0
    for char in sentence:
        checksum ^= ord(char)
    return f"{checksum:02X}"


def compute_crc16_ccitt(data: bytes, poly: int = 0x1021, init: int = 0xFFFF) -> int:
    """Computes 16-bit CRC-CCITT."""
    crc = init
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ poly) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return crc


class TelemetryStreamDecoder:
    """Stream reassembler and flight computer telemetry parser."""

    def __init__(self, ground_elevation_m: float = 0.0, sea_level_hpa: float = 1013.25):
        self.ground_elevation_m = ground_elevation_m
        self.sea_level_hpa = sea_level_hpa
        self._buffer: str = ""
        self.current_phase: FlightPhase = FlightPhase.PAD_IDLE
        self.max_altitude_m: float = 0.0
        self.last_altitude_m: Optional[float] = None
        self.last_time_s: Optional[float] = None
        self.packets: List[TelemetryPacket] = []

    def feed(self, chunk: str) -> List[TelemetryPacket]:
        """Ingests arbitrary chunks of streaming serial text, yielding complete decoded packets."""
        self._buffer += chunk
        decoded_packets: List[TelemetryPacket] = []

        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            line = line.strip("\r").strip()
            if not line:
                continue
            packet = self.parse_sentence(line)
            if packet is not None:
                decoded_packets.append(packet)
                self.packets.append(packet)

        return decoded_packets

    def parse_sentence(self, sentence: str) -> Optional[TelemetryPacket]:
        """Parses a single formatted telemetry sentence.
        Format: $ROCKY,time_s,pressure_hpa,accel_g,batt_v,temp_c*CHECKSUM
        Example: $ROCKY,1.42,985.3,4.2,7.4,24.5*1A
        """
        if not sentence.startswith("$ROCKY,"):
            return None

        # Checksum validation
        if "*" in sentence:
            payload, provided_checksum = sentence[1:].split("*", 1)
            expected_checksum = compute_xor_checksum(payload)
            if provided_checksum.upper() != expected_checksum:
                # Checksum mismatch, reject corrupted frame
                return None
            body = payload
        else:
            body = sentence[1:]

        tokens = body.split(",")
        if len(tokens) < 6:
            return None

        try:
            # tokens: ['ROCKY', time_s, press_hpa, accel_g, batt_v, temp_c]
            time_s = float(tokens[1])
            pressure_hpa = float(tokens[2])
            accel_g = float(tokens[3])
            batt_v = float(tokens[4])
            temp_c = float(tokens[5])
        except ValueError:
            return None

        # Calculate AGL (Above Ground Level) altitude
        raw_alt = calculate_pressure_altitude_m(pressure_hpa, self.sea_level_hpa)
        agl_alt = max(0.0, raw_alt - self.ground_elevation_m)

        # Numerical vertical velocity
        velocity_mps = 0.0
        if self.last_time_s is not None and self.last_altitude_m is not None:
            dt = time_s - self.last_time_s
            if dt > 0.001:
                velocity_mps = (agl_alt - self.last_altitude_m) / dt

        self.last_time_s = time_s
        self.last_altitude_m = agl_alt

        # Update apogee
        if agl_alt > self.max_altitude_m:
            self.max_altitude_m = agl_alt

        # State machine transition
        self.current_phase = self._evaluate_phase(agl_alt, velocity_mps, accel_g)

        return TelemetryPacket(
            timestamp_s=round(time_s, 3),
            pressure_hpa=round(pressure_hpa, 2),
            altitude_m=round(agl_alt, 2),
            vertical_velocity_mps=round(velocity_mps, 2),
            vertical_accel_g=round(accel_g, 2),
            battery_voltage_v=round(batt_v, 2),
            temperature_c=round(temp_c, 1),
            phase=self.current_phase,
            raw_sentence=sentence,
        )

    def _evaluate_phase(self, altitude_m: float, velocity_mps: float, accel_g: float) -> FlightPhase:
        """Determines the flight phase based on sensor kinematics."""
        if self.current_phase == FlightPhase.PAD_IDLE:
            if accel_g > 2.0 or altitude_m > 5.0:
                return FlightPhase.POWERED_FLIGHT
            return FlightPhase.PAD_IDLE

        elif self.current_phase == FlightPhase.POWERED_FLIGHT:
            if accel_g < 0.2 and velocity_mps > 5.0:
                return FlightPhase.COASTING
            if velocity_mps <= 0.0 and altitude_m > 20.0:
                return FlightPhase.APOGEE
            return FlightPhase.POWERED_FLIGHT

        elif self.current_phase == FlightPhase.COASTING:
            if velocity_mps <= 0.5 or (self.max_altitude_m - altitude_m > 2.0):
                return FlightPhase.APOGEE
            return FlightPhase.COASTING

        elif self.current_phase == FlightPhase.APOGEE:
            return FlightPhase.DROGUE_DESCENT

        elif self.current_phase == FlightPhase.DROGUE_DESCENT:
            # Main deploy altitude (typically ~120m AGL)
            if altitude_m <= 120.0 and altitude_m > 3.0:
                return FlightPhase.MAIN_DESCENT
            if altitude_m <= 2.0 and abs(velocity_mps) < 1.0:
                return FlightPhase.LANDED
            return FlightPhase.DROGUE_DESCENT

        elif self.current_phase == FlightPhase.MAIN_DESCENT:
            if altitude_m <= 3.0 and abs(velocity_mps) < 1.5:
                return FlightPhase.LANDED
            return FlightPhase.MAIN_DESCENT

        return self.current_phase
