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
  "clavicle.prot": 8,
  "clavicle.elev": 8,
  "shoulder.twist": 4,
  "shoulder.plane": 78,
  "elbow.flex": 6,
  "forearm.pron": 74,
  "wrist.flex": -8,
};

/** Hips over the knees, arms straight down on the wheel. */
const START = {
  ...BRACED,
  "root.pitch": 62,
  "shoulder.elev": 70,
};

/** A short rollout: arms reach forward, knees stay folded, back stays flat. */
const OUT = {
  ...BRACED,
  "root.pitch": 34,
  "root.z": 0.1,
  "shoulder.elev": 108,
};

export const spec = buildExerciseSpec({
  id: "ab-wheel-rollout",
  catalogId: "1a45c6f170d8805aae34cfd9a6eb7eec",
  name: "Ab Wheel Rollout",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Set", "Roll", "Out", "Return"],
  station: { kind: "kneeling" },
  apparatus: { kind: "ab-wheel" },
  stiffness: { lumbar: 12, thoracic: 8, hip: 6, elbow: 10, shoulder: 2, knee: 10, ankle: 6 },
  hints: { start: START, end: OUT },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 92, 28),
    lockAngle(body, "knee_R.flex", 92, 28),
    lockAngle(body, "ankle_L.dorsi", -25, 16),
    lockAngle(body, "ankle_R.dorsi", -25, 16),
    lockAngle(body, "lumbar.flex", 6, 20),
    lockAngle(body, "thoracic.flex", 4, 16),
    lockAngle(body, "clavicle_L.elev", 6, 36),
    lockAngle(body, "clavicle_R.elev", 6, 36),
    lockAngle(body, "clavicle_L.prot", 4, 40),
    lockAngle(body, "clavicle_R.prot", 4, 40),
    pin(body, "kneeFront_L", () => new Vector3(0.14, 0.07, 0.02), 90),
    pin(body, "kneeFront_R", () => new Vector3(-0.14, 0.07, 0.02), 90),
    pin(body, "ballIn_L", () => new Vector3(0.13, 0.12, -0.34), 110, "y"),
    pin(body, "ballIn_R", () => new Vector3(-0.13, 0.12, -0.34), 110, "y"),
    pin(body, "ballOut_L", () => new Vector3(0.18, 0.12, -0.34), 110, "y"),
    pin(body, "ballOut_R", () => new Vector3(-0.18, 0.12, -0.34), 110, "y"),
  ],
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "grip_L", () => new Vector3(0.13, 0.1, 0.38), 70, "z"),
      pin(body, "grip_R", () => new Vector3(-0.13, 0.1, 0.38), 70, "z"),
    ],
    end: [
      pin(body, "grip_L", () => new Vector3(0.13, 0.1, 0.68), 70, "z"),
      pin(body, "grip_R", () => new Vector3(-0.13, 0.1, 0.68), 70, "z"),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Keep the torso rigidly braced and the lower back flat. Only roll as far as you can without letting the hips sag or the ribs flare.",
      12,
    ),
    checkJointRange(
      "roll-out",
      "Shoulders travel forward over the wheel",
      "Push the ab wheel forward by moving the hips and arms together, with the elbows fully straightened.",
      "shoulder_L.elev",
      6,
    ),
    checkAnchorTravel(
      "wheel-rolls",
      "The wheel rolls forward and back",
      "Push the ab wheel forward only as far as the flat lower back allows, then pull it back until the arms point down under the shoulders.",
      "grip_L",
      "z",
      0.09,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows fully straightened as the hips and shoulders move together.",
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
