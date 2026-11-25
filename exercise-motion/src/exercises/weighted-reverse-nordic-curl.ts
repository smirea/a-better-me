import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

const GOBLET = {
  "clavicle.elev": 6,
  "shoulder.elev": 48,
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "elbow.flex": 112,
  "forearm.pron": -50,
  "wrist.flex": 8,
};

const UP = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.52,
  "root.z": 0.02,
  "root.pitch": 2,
  "hip.flex": 6,
  "hip.abd": 6,
  "knee.flex": 96,
  "ankle.dorsi": -12,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...GOBLET,
};

const BACK = {
  ...UP,
  "root.y": 0.38,
  "root.z": -0.08,
  "root.pitch": -36,
  "hip.flex": 6,
  "knee.flex": 132,
};

export const spec = buildExerciseSpec({
  id: "weighted-reverse-nordic-curl",
  catalogId: "2085c6f170d8803bbe94fb1385fe534d",
  name: "Weighted Reverse Nordic Curl",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lean", "Back", "Rise", "Tall"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.8, top: 0.3 },
  station: { kind: "kneeling", mat: true },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  stiffness: { hip: 8, lumbar: 12, thoracic: 10, knee: 2, elbow: 6, ankle: 8 },
  hints: { start: UP, end: BACK },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 6, 28),
    lockAngle(body, "hip_R.flex", 6, 28),
    lockAngle(body, "lumbar.flex", 4, 16),
    lockAngle(body, "elbow_L.flex", 112, 18),
    lockAngle(body, "elbow_R.flex", 112, 18),
    pin(body, "toe_L", () => new Vector3(0.14, 0.055, -0.4), 64, "y"),
    pin(body, "toe_R", () => new Vector3(-0.14, 0.055, -0.4), 64, "y"),
  ],
  checks: () => [
    checkJointWithinAt(
      "upright-start",
      "Starts tall on the knees",
      "Kneel upright holding the weight at the chest.",
      "knee_L.flex",
      "start",
      80,
      115,
    ),
    checkJointWithinAt(
      "lean-back",
      "Torso leans back from the knees",
      "Lean backward by bending only at the knees, through the range your strength allows.",
      "knee_L.flex",
      "peak",
      115,
      155,
    ),
    checkJointWithinAt(
      "hips-open",
      "Thighs and torso stay in one line",
      "Keep the hips open so the thigh, hip, and torso stay in one line.",
      "hip_L.flex",
      "peak",
      -8,
      22,
    ),
    checkJointWithinAt(
      "goblet",
      "Weight stays at the chest",
      "Hold the weight with both hands right next to the chest, elbows bent.",
      "elbow_L.flex",
      "peak",
      85,
      140,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend and extend through the lean",
      "The motion comes from the knees. Rise back until the torso is upright.",
      "knee_L.flex",
      24,
    ),
  ],
});
