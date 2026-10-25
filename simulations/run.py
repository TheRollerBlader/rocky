#!/usr/bin/env python3
"""Run Rocky's saved OpenRocket flights at the same time.

OpenRocket is the simulator. This script only starts it. Each flight gets
its own process, because one Python process can only hold one OpenRocket
engine. Five workers therefore fly the five saved cases together.

The design file is openrocket/rocky.ork (OpenRocket 24.12). It already
contains the five DARS flights at 60 °F on a six-foot rod.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORK = ROOT / "openrocket" / "rocky.ork"
OUT = ROOT / "simulations" / "results" / "summary.csv"


def design_xml(path: Path) -> bytes:
    raw = path.read_bytes()
    if raw[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            member = next(name for name in archive.namelist() if name.endswith((".ork", ".xml")))
            return archive.read(member)
    return raw


def simulation_names(path: Path) -> list[str]:
    root = ET.fromstring(design_xml(path))
    names: list[str] = []
    for simulation in root.iter("simulation"):
        name = (simulation.findtext("name") or simulation.attrib.get("name") or "").strip()
        if name:
            names.append(name)
    return names


def fly_one(index: int) -> dict[str, str]:
    try:
        import orlab
    except ImportError as error:
        raise SystemExit(
            "orlab is not installed. From the repo root:\n"
            "  python3 -m pip install -r simulations/requirements.txt\n"
            "  python3 -m orlab fetch"
        ) from error

    with orlab.OpenRocketInstance() as instance:
        helper = orlab.Helper(instance)
        document = helper.load_doc(str(ORK))
        simulation = document.getSimulation(index)
        name = str(simulation.getName())
        helper.run_simulation(simulation, randomize_seed=False)
        summary = helper.get_summary(simulation)

    row = {"index": str(index), "name": name}
    if isinstance(summary, dict):
        for key, value in summary.items():
            row[str(key)] = "" if value is None else str(value)
    else:
        row["summary"] = str(summary)
    return row


def main() -> int:
    parser = argparse.ArgumentParser(description="Fly Rocky's saved OpenRocket simulations together.")
    parser.add_argument("--list", action="store_true", help="Print the saved flights and exit.")
    parser.add_argument("--workers", type=int, default=0, help="How many flights to run at once. Default: all of them.")
    args = parser.parse_args()

    if not ORK.is_file():
        print(f"Missing design file: {ORK}", file=sys.stderr)
        return 1

    names = simulation_names(ORK)
    if args.list or not names:
        for index, name in enumerate(names):
            print(f"{index:02d}  {name}")
        return 0 if names else 1

    workers = args.workers if args.workers > 0 else len(names)
    workers = max(1, min(workers, len(names)))
    print(f"Flying {len(names)} saved simulations on {workers} workers")

    rows: list[dict[str, str]] = []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fly_one, index): index for index in range(len(names))}
        for future in as_completed(futures):
            row = future.result()
            rows.append(row)
            print(f"done  {row['name']}")

    rows.sort(key=lambda row: int(row["index"]))
    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
