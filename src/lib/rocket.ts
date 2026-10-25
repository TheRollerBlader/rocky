export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export type PartFinish = {
  color: string;
  roughness: number;
  metalness: number;
  kind: "paper" | "paint" | "cardboard" | "metal";
};

const WHITE = "#f4f1ea";
const BLUE = "#0083E0";
const BLACK = "#141618";
const GRAPHITE = "#2c3138";
const GRAY = "#5c636c";
const KRAFT = "#8d6b45";

export const FINISH: Record<string, PartFinish> = {
  nose_cone: { color: BLUE, roughness: 0.28, metalness: 0.03, kind: "paint" },
  payload_bay: { color: WHITE, roughness: 0.52, metalness: 0.02, kind: "paper" },
  transition: { color: BLACK, roughness: 0.48, metalness: 0.04, kind: "paint" },
  body_tube: { color: GRAPHITE, roughness: 0.58, metalness: 0.03, kind: "paint" },
  launch_lug: { color: GRAY, roughness: 0.46, metalness: 0.12, kind: "metal" },
  bulkhead: { color: "#c4b49a", roughness: 0.78, metalness: 0, kind: "cardboard" },
  altimeter_cradle: { color: "#efe8dc", roughness: 0.8, metalness: 0, kind: "paper" },
  altimeter: { color: "#1a1c20", roughness: 0.42, metalness: 0.18, kind: "metal" },
  egg_capsule: { color: "#f3efe6", roughness: 0.8, metalness: 0, kind: "paper" },
  egg_1: { color: "#f3e2c4", roughness: 0.55, metalness: 0, kind: "paint" },
  egg_2: { color: "#f3e2c4", roughness: 0.55, metalness: 0, kind: "paint" },
  ballast_cartridge: { color: GRAPHITE, roughness: 0.5, metalness: 0.06, kind: "paint" },
  ballast_clay: { color: "#6e5039", roughness: 0.86, metalness: 0, kind: "cardboard" },
  parachute: { color: BLUE, roughness: 0.78, metalness: 0, kind: "paper" },
  chute_protector: { color: "#e7dcc4", roughness: 0.84, metalness: 0, kind: "paper" },
  motor_mount_tube: { color: KRAFT, roughness: 0.86, metalness: 0, kind: "cardboard" },
  centering_ring_fwd: { color: "#b89a72", roughness: 0.82, metalness: 0, kind: "cardboard" },
  centering_ring_aft: { color: "#b89a72", roughness: 0.82, metalness: 0, kind: "cardboard" },
  engine_block: { color: GRAPHITE, roughness: 0.55, metalness: 0.08, kind: "metal" },
  motor_retainer: { color: GRAY, roughness: 0.38, metalness: 0.42, kind: "metal" },
  motor: { color: "#3a3e44", roughness: 0.46, metalness: 0.28, kind: "metal" },
  fin_1: { color: BLUE, roughness: 0.5, metalness: 0.02, kind: "paint" },
  fin_2: { color: BLUE, roughness: 0.5, metalness: 0.02, kind: "paint" },
  fin_3: { color: BLUE, roughness: 0.5, metalness: 0.02, kind: "paint" },
};

export type ExplodeGroup = {
  id: string;
  parts: string[];
  z: number;
  x: number;
  radial: boolean;
  label: string;
  detail: string;
  category: string;
  description: string;
  side: "left" | "right";
  mobile: boolean;
  specs: { label: string; value: string }[];
};

/** Shifts are millimeters at full explode. Positive Z is toward the nose. */
export const EXPLODE_GROUPS: ExplodeGroup[] = [
  {
    id: "nose",
    parts: ["nose_cone"],
    z: 210,
    x: 0,
    radial: false,
    label: "Nose Cone",
    detail: "Polystyrene Ogive · 150 mm",
    category: "Aerodynamics",
    description: "Tangent ogive shape tuned for minimum subsonic pressure drag. Protects the avionics bay during peak acceleration.",
    side: "right",
    mobile: true,
    specs: [
      { label: "Profile", value: "Tangent Ogive" },
      { label: "Length", value: "150 mm" },
      { label: "Max Diameter", value: "66.0 mm" },
      { label: "Finish", value: "Painted blue" },
    ],
  },
  {
    id: "altimeter",
    parts: ["altimeter", "altimeter_cradle"],
    z: 140,
    x: 170,
    radial: false,
    label: "Avionics & Altimeter",
    detail: "Jolly Logic AltimeterTwo",
    category: "Avionics",
    description: "Jolly Logic AltimeterTwo, about 10 g, in a foam puck. Three 1.5 mm vent holes in the payload tube.",
    side: "right",
    mobile: false,
    specs: [
      { label: "Unit", value: "Jolly Logic AltimeterTwo" },
      { label: "Mass", value: "About 10 g" },
      { label: "Vents", value: "3 × 1.5 mm holes" },
      { label: "Mount", value: "Foam puck under the nose" },
    ],
  },
  {
    id: "payload",
    parts: ["payload_bay", "launch_lug"],
    z: 60,
    x: 0,
    radial: false,
    label: "Payload Airframe",
    detail: "BT-80 Kraft Tubing · 66 mm",
    category: "Airframe",
    description: "Upper fuselage carrying the contest egg payload capsule and ballast trim system. Painted white over kraft tube.",
    side: "left",
    mobile: false,
    specs: [
      { label: "Tube Spec", value: "BT-80 Airframe" },
      { label: "Outer Diameter", value: "66.0 mm" },
      { label: "Inner Diameter", value: "65.0 mm" },
      { label: "Finish", value: "Painted white" },
    ],
  },
  {
    id: "eggs",
    parts: ["egg_capsule", "egg_1", "egg_2"],
    z: 35,
    x: -175,
    radial: false,
    label: "Dual Egg Capsule",
    detail: "Two Raw Grade-A Eggs",
    category: "Contest Payload",
    description: "Carries two raw hen's eggs mounted in soft memory foam. Eggs must return completely intact without hairline cracks to qualify.",
    side: "left",
    mobile: true,
    specs: [
      { label: "Payload", value: "2 raw eggs, 55–63 g each" },
      { label: "Orientation", value: "Tandem Longitudinal" },
      { label: "Protection", value: "Dual Shock Foam Liner" },
      { label: "ARC Spec", value: "Zero Crack Tolerance" },
    ],
  },
  {
    id: "ballast",
    parts: ["ballast_cartridge", "ballast_clay", "bulkhead"],
    z: -25,
    x: 180,
    radial: false,
    label: "Ballast Trim System",
    detail: "Clay Cartridge · 41–75 g",
    category: "Trim & Stability",
    description: "A PETG cup of modeling clay on the payload bulkhead. Adding clay only raises stability, about 0.0012 cal per gram, and holds the mean apogee on 800 feet.",
    side: "right",
    mobile: true,
    specs: [
      { label: "Adjustment", value: "41 g to 75 g" },
      { label: "Ballast Material", value: "High-density Modeling Clay" },
      { label: "Card means", value: "797–804 ft" },
      { label: "Stability", value: "1.94–2.03 cal" },
    ],
  },
  {
    id: "chute",
    parts: ["parachute", "chute_protector"],
    z: -85,
    x: -170,
    radial: false,
    label: "Recovery Parachute",
    detail: "18.5 in ripstop nylon",
    category: "Recovery",
    description: "An 18.5 in flat ripstop circle with eight lines. Mean flight time is 38.2–39.5 seconds at 50–80 °F.",
    side: "left",
    mobile: false,
    specs: [
      { label: "Canopy", value: "18.5 in flat circle" },
      { label: "Material", value: "Ripstop nylon" },
      { label: "Descent", value: "23–26 ft/s" },
      { label: "Deployment", value: "Motor ejection, 8 s delay" },
    ],
  },
  {
    id: "transition",
    parts: ["transition"],
    z: -125,
    x: 0,
    radial: false,
    label: "Transition Adapter",
    detail: "BT-80 to BT-60 Reducer",
    category: "Aerodynamics",
    description: "Molded polystyrene reducer from the 66 mm payload tube to the 41.6 mm booster. 65 mm long, modeled as a 1.5 mm wall.",
    side: "right",
    mobile: false,
    specs: [
      { label: "Stepdown", value: "66.0 mm to 41.6 mm" },
      { label: "Length", value: "65 mm" },
      { label: "Material", value: "Molded polystyrene" },
      { label: "Mass", value: "31.4 g modeled" },
    ],
  },
  {
    id: "booster",
    parts: ["body_tube"],
    z: -195,
    x: 0,
    radial: false,
    label: "Booster Airframe",
    detail: "BT-60 Lower Airframe Tube",
    category: "Airframe",
    description: "High-strength lower body tube housing the motor mount assembly and anchoring the through-the-wall fin tabs.",
    side: "left",
    mobile: false,
    specs: [
      { label: "Tube Spec", value: "BT-60 Airframe" },
      { label: "Outer Diameter", value: "41.6 mm" },
      { label: "Length", value: "150 mm" },
      { label: "Finish", value: "Satin Graphite Black" },
    ],
  },
  {
    id: "fins",
    parts: ["fin_1", "fin_2", "fin_3"],
    z: -210,
    x: 0,
    radial: true,
    label: "Swept Fin Assembly",
    detail: "3× Balsa Airfoils @ 120°",
    category: "Stability",
    description: "Three clipped-delta balsa fins, 3/16 in thick, through the wall to the motor tube. Static stability is 2.01 cal at the baseline ballast.",
    side: "right",
    mobile: true,
    specs: [
      { label: "Count", value: "3 Fins (120° Spacing)" },
      { label: "Material", value: "3/16 in balsa" },
      { label: "Static Margin", value: "2.01 calibers" },
      { label: "Root Mount", value: "Through-the-wall Double Fillet" },
    ],
  },
  {
    id: "motor",
    parts: [
      "motor",
      "motor_mount_tube",
      "centering_ring_fwd",
      "centering_ring_aft",
      "engine_block",
      "motor_retainer",
    ],
    z: -300,
    x: 0,
    radial: false,
    label: "Propulsion Assembly",
    detail: "AeroTech F44W-8",
    category: "Propulsion",
    description: "A 24 × 70 mm single-use motor. OpenRocket curve is 42.2 N·s, average 51.4 N, 0.82 s burn, with an 8 second delay.",
    side: "right",
    mobile: true,
    specs: [
      { label: "Motor", value: "AeroTech F44W-8" },
      { label: "Impulse", value: "42.2 N·s" },
      { label: "Average thrust", value: "51.4 N" },
      { label: "Burn", value: "0.82 s, 8 s delay" },
    ],
  },
];
