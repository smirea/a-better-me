import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { flatBench } from "../equipment";
import { checkAnchorTravel, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Shoulders stay on a flat bench; the straight body hinges there. */
const BENCH_Y = 0.5;
const BENCH = flatBench({ topY: BENCH_Y, zHead: -0.28, zFoot: 0.28 });

const GRIP = {
  "shoulder.elev": 158,
  "shoulder.plane": 70,
  "shoulder.twist": 16,
  "elbow.flex": 78,
  "forearm.pron": 70,
  "wrist.flex": 8,
  "clavicle.elev": -4,
};

/** Body nearly horizontal, hips clear of the bench, legs straight. */
const LOW = {
  "root.y": 0.66,
  "root.z": 0.28,
  "root.pitch": -78,
  "lumbar.flex": 14,
  "thoracic.flex": 6,
  "neck.flex": 6,
  "hip.flex": 10,
  "hip.abd": 4,
  "knee.flex": 8,
  "ankle.dorsi": -6,
  ...GRIP,
};

/** Straight body stacked vertically over the shoulders. */
const HIGH = {
  ...LOW,
  "root.y": 1.12,
  "root.z": -0.02,
  "root.pitch": -132,
  "lumbar.flex": 18,
  "thoracic.flex": 8,
  "hip.flex": 14,
  "knee.flex": 10,
};

export const spec = buildExerciseSpec({
  id: "dragon-flag",
  catalogId: "2e85c6f170d8804e8135c60af24fdd93",
  name: "Dragon Flag",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Lower", "Hover", "Raise", "Vertical"],
  ground: "upperBack",
  station: { kind: "cardio", machine: "none" },
  extraEquipment: BENCH,
  extraContacts: {
    "bench.pad": { chest: 0.05, girdle: 0.04, head: 0.04, abdomen: 0.03, hand_L: 0.07, hand_R: 0.07 },
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 18, thoracic: 14, hip: 8, knee: 6, shoulder: 3, elbow: 4 },
  extraGoals: (body) => [
    pin(body, "upperBack", () => new Vector3(0, BENCH_Y - 0.02, -0.05), 56, "xy"),
    pin(body, "occiput", () => new Vector3(0, BENCH_Y + 0.02, -0.42), 22, "y"),
    pin(body, "grip_L", () => new Vector3(0.2, BENCH_Y - 0.06, -0.32), 28),
    pin(body, "grip_R", () => new Vector3(-0.2, BENCH_Y - 0.06, -0.32), 28),
  ],
  hints: { start: LOW, end: HIGH },
  checks: () => [
    checkAnchorTravel(
      "body-rises",
      "The straight body rises toward vertical",
      "Raise and lower the body as one straight line from the shoulders, keeping the hips and knees extended. Only the shoulders stay on the bench.",
      "heel_L",
      "y",
      0.3,
    ),
    checkJointWithinAt(
      "legs-straight",
      "Knees stay nearly straight",
      "A straight-leg dragon flag keeps the knees extended so the legs and torso travel as one rigid lever.",
      "knee_L.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "hips-extended",
      "Hips stay extended",
      "Do not fold at the hips. The thighs stay in line with the torso while the shoulders remain the pivot.",
      "hip_L.flex",
      "peak",
      -8,
      32,
    ),
    checkJointWithinAt(
      "ribs-down",
      "Ribs stay pulled down",
      "Brace the abs and keep a slight posterior tilt so the lower back does not hyperextend as the body lowers.",
      "lumbar.flex",
      "start",
      0,
      32,
    ),
    checkNeutralNeck("Keep the neck quiet against the bench rather than craning to watch the feet.", 32),
  ],
});
