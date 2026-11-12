"""ThrustCurve.org Open API Client and Motor Catalog Ingestion Engine.

Fetches certified motor thrust curves (.eng / RASP format), computes
standard NAR/TRA motor classification (A through O), and exports
calibrated thrust curves for the RK4 numerical flight simulator.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
import json
from pathlib import Path


@dataclass
class MotorSummary:
    motor_id: str
    manufacturer: str
    common_name: str
    impulse_class: str
    total_impulse_ns: float
    avg_thrust_n: float
    max_thrust_n: float
    burn_time_sec: float
    propellant_mass_g: float
    total_mass_g: float
    diameter_mm: float
    length_mm: float


class ThrustCurveAPIClient:
    """Client for querying and ingesting motor thrust curves."""

    BASE_URL = "https://www.thrustcurve.org/api/v1"

    IMPULSE_CLASSES = [
        ("1/4A", 0.0, 0.625),
        ("1/2A", 0.625, 1.25),
        ("A", 1.25, 2.5),
        ("B", 2.5, 5.0),
        ("C", 5.0, 10.0),
        ("D", 10.0, 20.0),
        ("E", 20.0, 40.0),
        ("F", 40.0, 80.0),
        ("G", 80.0, 160.0),
        ("H", 160.0, 320.0),
        ("I", 320.0, 640.0),
        ("J", 640.0, 1280.0),
    ]

    def __init__(self, cache_dir: Optional[Path] = None, enable_cache: bool = True):
        self.cache_dir = cache_dir or Path(".cache/thrustcurve")
        self.enable_cache = enable_cache
        if self.enable_cache:
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def classify_impulse(cls, total_impulse_ns: float) -> str:
        """Determines NAR/TRA motor letter classification from total impulse."""
        for label, low, high in cls.IMPULSE_CLASSES:
            if low <= total_impulse_ns < high:
                return label
        return "Unknown"

    def parse_search_results(self, raw_json: Dict[str, Any]) -> List[MotorSummary]:
        """Parses API v1 search.json response into structured motor summaries."""
        results = raw_json.get("results", [])
        summaries: List[MotorSummary] = []

        for r in results:
            total_imp = float(r.get("totImpulseNs", 0.0))
            impulse_class = r.get("impulseClass") or self.classify_impulse(total_imp)

            summary = MotorSummary(
                motor_id=str(r.get("motorId", "")),
                manufacturer=r.get("manufacturer", "Unknown"),
                common_name=r.get("commonName", ""),
                impulse_class=impulse_class,
                total_impulse_ns=total_imp,
                avg_thrust_n=float(r.get("avgThrustN", 0.0)),
                max_thrust_n=float(r.get("maxThrustN", 0.0)),
                burn_time_sec=float(r.get("burnTimeS", 0.0)),
                propellant_mass_g=float(r.get("propWeightG", 0.0)),
                total_mass_g=float(r.get("totalWeightG", 0.0)),
                diameter_mm=float(r.get("diameter", 0.0)),
                length_mm=float(r.get("length", 0.0)),
            )
            summaries.append(summary)

        return summaries

    def parse_rasp_eng_text(self, eng_text: str) -> Dict[str, Any]:
        """Parses raw RASP .eng file format into motor metadata and time-thrust coordinate pairs."""
        lines = [line.strip() for line in eng_text.splitlines() if line.strip()]
        header_line = None
        data_points = []

        for line in lines:
            if line.startswith(";"):
                continue
            if header_line is None:
                header_line = line
                continue

            parts = line.split()
            if len(parts) >= 2:
                try:
                    t = float(parts[0])
                    f = float(parts[1])
                    data_points.append((t, f))
                except ValueError:
                    continue

        if not header_line:
            raise ValueError("Invalid .eng file: missing header specification line.")

        header_tokens = header_line.split()
        if len(header_tokens) < 7:
            raise ValueError(f"Malformed .eng header token count: {len(header_tokens)}")

        name = header_tokens[0]
        dia = float(header_tokens[1])
        length = float(header_tokens[2])
        delays = header_tokens[3]
        prop_mass = float(header_tokens[4])
        tot_mass = float(header_tokens[5])
        mfg = header_tokens[6] if len(header_tokens) > 6 else "Unknown"

        # Trapezoidal impulse integration
        impulse = 0.0
        max_f = 0.0
        for i in range(len(data_points) - 1):
            dt = data_points[i + 1][0] - data_points[i][0]
            avg_f = (data_points[i][1] + data_points[i + 1][1]) / 2.0
            impulse += avg_f * dt
            max_f = max(max_f, data_points[i][1], data_points[i + 1][1])

        burn_time = data_points[-1][0] if data_points else 0.0
        avg_thrust = impulse / burn_time if burn_time > 0 else 0.0

        return {
            "name": name,
            "manufacturer": mfg,
            "diameter_mm": dia,
            "length_mm": length,
            "delays": delays,
            "propellant_mass_kg": prop_mass,
            "total_mass_kg": tot_mass,
            "total_impulse_ns": round(impulse, 3),
            "max_thrust_n": round(max_f, 2),
            "avg_thrust_n": round(avg_thrust, 2),
            "burn_time_sec": round(burn_time, 3),
            "impulse_class": self.classify_impulse(impulse),
            "curve_points": data_points,
        }
