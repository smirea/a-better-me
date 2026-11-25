import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

const ARMS = {
  "clavicle.elev": 2,
  "shoulder.elev": 10,
  "shoulder.plane": 6,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 16,
  "wrist.flex": 0,
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
  ...ARMS,
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
  id: "reverse-nordic-curl",
  catalogId: "1a25c6f170d880819de8ddcc87a7fb24",
  name: "Reverse Nordic Curl",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lean", "Back", "Rise", "Tall"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.8, top: 0.3 },
  station: { kind: "kneeling", mat: true },
  apparatus: { kind: "none" },
  stiffness: { hip: 8, lumbar: 12, thoracic: 10, knee: 2, elbow: 6, ankle: 8 },
  hints: { start: UP, end: BACK },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 6, 28),
    lockAngle(body, "hip_R.flex", 6, 28),
    lockAngle(body, "lumbar.flex", 4, 16),
    pin(body, "toe_L", () => new Vector3(0.14, 0.055, -0.4), 64, "y"),
    pin(body, "toe_R", () => new Vector3(-0.14, 0.055, -0.4), 64, "y"),
  ],
  checks: () => [
    checkJointWithinAt(
      "upright-start",
      "Starts tall on the knees",
      "Kneel upright with the arms by the sides.",
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
      "arms-down",
      "Arms stay by the sides",
      "Keep the arms in place at the sides with the elbows straight.",
      "elbow_L.flex",
      "peak",
      0,
      24,
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
