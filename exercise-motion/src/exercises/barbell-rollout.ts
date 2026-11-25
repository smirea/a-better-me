import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

const BRACED = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.55,
  "root.z": -0.04,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 4,
  "hip.flex": 14,
  "hip.abd": 8,
  "knee.flex": 92,
  "ankle.dorsi": -25,
  "clavicle.prot": 4,
  "shoulder.twist": 6,
  "shoulder.plane": 96,
  "elbow.flex": 6,
  "forearm.pron": 74,
  "wrist.flex": -8,
};

const START = {
  ...BRACED,
  "root.pitch": 58,
  "shoulder.elev": 76,
};

const OUT = {
  ...BRACED,
  "root.pitch": 36,
  "root.z": 0.08,
  "shoulder.elev": 112,
};

export const spec = buildExerciseSpec({
  id: "barbell-rollout",
  catalogId: "1a45c6f170d880a8a935e8224408760c",
  name: "Barbell Rollout",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Set", "Roll", "Out", "Return"],
  station: { kind: "kneeling" },
  apparatus: {
    kind: "barbell",
    gripX: 0.28,
    anchor: "grip",
    path: { startY: 0.225, startZ: 0.42, endY: 0.225, endZ: 0.78 },
  },
  stiffness: { lumbar: 12, thoracic: 8, hip: 6, elbow: 10, shoulder: 3, knee: 10, ankle: 6 },
  hints: { start: START, end: OUT },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 92, 28),
    lockAngle(body, "knee_R.flex", 92, 28),
    lockAngle(body, "ankle_L.dorsi", -25, 16),
    lockAngle(body, "ankle_R.dorsi", -25, 16),
    lockAngle(body, "lumbar.flex", 6, 20),
    lockAngle(body, "thoracic.flex", 4, 16),
    pin(body, "kneeFront_L", () => new Vector3(0.14, 0.07, 0.02), 90),
    pin(body, "kneeFront_R", () => new Vector3(-0.14, 0.07, 0.02), 90),
    pin(body, "ballIn_L", () => new Vector3(0.13, 0.12, -0.34), 110, "y"),
    pin(body, "ballIn_R", () => new Vector3(-0.13, 0.12, -0.34), 110, "y"),
    pin(body, "ballOut_L", () => new Vector3(0.18, 0.12, -0.34), 110, "y"),
    pin(body, "ballOut_R", () => new Vector3(-0.18, 0.12, -0.34), 110, "y"),
  ],
  checks: () => [
    checkFlatBack(
      "Keep the torso rigidly braced and avoid letting the lower back arch. Scoop the hips so the ribs stay pulled down toward the hip bones.",
      12,
    ),
    checkJointRange(
      "roll-out",
      "The bar rolls forward under straight arms",
      "Push the bar forward with the elbows fully straightened until the arms are outstretched in line with the torso.",
      "shoulder_L.elev",
      18,
    ),
    checkAnchorTravel(
      "bar-rolls",
      "The bar rolls forward and back",
      "Push the bar forward with straight elbows, then pull it back until the arms point down and the hips are over the knees.",
      "grip_L",
      "z",
      0.2,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows and wrists stay straight",
      "Firmly grasp the bar with straight elbows and wrists, and keep them straight throughout the rollout.",
      "elbow_L.flex",
      "peak",
      -6,
      22,
    ),
    checkNeutralNeck(
      "Keep the neck near a neutral position, like when you are normally standing upright and looking straight ahead.",
    ),
  ],
});
