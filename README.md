# Rocky 1

A scratch-built competition rocket for the American Rocketry Challenge 2027. Two eggs, an 800-foot target, and a flight that has to land between 37 and 40 seconds.

**Live site:** [rocky-rocketry.netlify.app](https://rocky-rocketry.netlify.app)

The site is the walkthrough: the model, the parts, and the flight card. This repository is the design behind it. The airframe is in `public/rocky.glb`. The OpenRocket file is in `openrocket/rocky.ork`.

## Airframe

Overall length is 765 mm. The upper tube is a BT-80. The booster is a BT-60. Nose and transition are molded plastic. Fins are three pieces of 3/16 in balsa, through the wall onto the motor tube.

![Rocky 1 side view](docs/diagrams/side-view.svg)

| Section | Size |
| --- | --- |
| Nose | 150 mm ogive, 45 mm shoulder, 66.04 mm base |
| Payload tube | BT-80, 66.04 mm OD, 400 mm |
| Transition | 65 mm, 66.04 mm down to 41.58 mm |
| Booster | BT-60, 41.58 mm OD, 150 mm |
| Motor | AeroTech F44W-8, 24 × 70 mm single-use |
| Recovery | 18.5 in flat ripstop circle |

![One fin](docs/diagrams/fin.svg)

Paint on the site matches the model: white payload, black transition, graphite booster, blue nose and fins.

## Simulations

The flights are OpenRocket simulations. The website does not invent them.

Five flights are already saved in `openrocket/rocky.ork`, all at 60 °F on a six-foot rod. To run them at the same time:

```bash
python3 -m pip install -r simulations/requirements.txt
python3 -m orlab fetch
python3 simulations/run.py
```

`run.py` starts one OpenRocket engine per flight, so the five cases fly together. You need Python 3.10+ and a JDK 17 or 21. The first `orlab fetch` downloads the OpenRocket engine and checks its checksum.

List the saved flights without flying them:

```bash
python3 simulations/run.py --list
```

Results are written to `simulations/results/summary.csv`. That folder stays off git. Open `rocky.ork` in the OpenRocket application if you want to change ballast, wind, or the chute and save a new flight.

## Site

```bash
npm install
npm run dev
```

The 3D model is generated from the STEP file with `npm run convert-rocket`. The published build is the page linked above.
