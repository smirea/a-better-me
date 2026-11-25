import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";

const ARMS = {
  "shoulder.elev": 62,
  "shoulder.plane": 58,
  "shoulder.twist": 30,
  "elbow.flex": 120,
  "forearm.pron": -15,
  "wrist.flex": 8,
  "clavicle.elev": 4,
};

/** Supine on the decline, head toward the low end, knees softly bent under the rollers. */
const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.46,
  "root.z": 0.0,
  "root.pitch": -104,
  "lumbar.flex": 6,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.flex": 36,
  "hip.abd": 6,
  "knee.flex": 28,
  "ankle.dorsi": 4,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.5,
  "root.z": -0.02,
  "root.pitch": -88,
  "lumbar.flex": 26,
  "thoracic.flex": 18,
  "neck.flex": 8,
  "hip.flex": 58,
};

export const spec = buildExerciseSpec({
  id: "decline-sit-up-with-hands-behind-head",
  catalogId: "1a35c6f170d880c6af22d69bbfc691fc",
  name: "Decline Sit-Up With Hands Behind Head",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Curl", "Sit", "Lower"],
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: -22,
    ankleRollers: true,
    feetOnFloor: false,
    passiveJoints: ["knee", "ankle"],
  },
  apparatus: { kind: "none" },
  tempo: { lower: 2.2, bottom: 0.3, raise: 2.2, top: 0.4 },
  extraGoals: (body) => [
    pin(body, "sacrum", () => new Vector3(0, 0.42, -0.04), 52),
    pin(body, "upperBack", () => new Vector3(0, 0.32, -0.36), 46),
    pin(body, "heel_L", () => new Vector3(0.14, 0.32, 0.5), 36),
    pin(body, "heel_R", () => new Vector3(-0.14, 0.32, 0.5), 36),
    lockAngle(body, "neck.flex", 8, 28),
  ],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "hip_L.flex", 42, 50),
      lockAngle(body, "hip_R.flex", 42, 50),
      lockAngle(body, "lumbar.flex", 6, 30),
      lockAngle(body, "thoracic.flex", 2, 24),
    ],
    end: [
      lockAngle(body, "hip_L.flex", 64, 50),
      lockAngle(body, "hip_R.flex", 64, 50),
      lockAngle(body, "lumbar.flex", 28, 30),
      lockAngle(body, "thoracic.flex", 18, 24),
    ],
  }),
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, chest: 0.04, thigh_L: 0.04, thigh_R: 0.04 },
    "bench.seatPad": { pelvis: 0.05, thigh_L: 0.05, thigh_R: 0.05, shank_L: 0.04, shank_R: 0.04 },
    "bench.rollerTop": { shank_L: 0.05, shank_R: 0.05, foot_L: 0.05, foot_R: 0.05 },
    "bench.rollerLow": { foot_L: 0.05, foot_R: 0.05, shank_L: 0.04, shank_R: 0.04 },
    "bench.spine": { chest: 0.045, girdle: 0.045, neck: 0.045, head: 0.03, abdomen: 0.03 },
    "bench.legBack": { girdle: 0.04, chest: 0.03, neck: 0.03 },
  },
  stiffness: { lumbar: 22, thoracic: 20, hip: 2, root: 2 },
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "Back rounds as the chest comes toward the thighs",
      "To train your abdominal muscles dynamically, your back should progressively round rather than remain in a flat position.",
      "lumbar.flex",
      16,
    ),
    checkJointRange(
      "full-sit-up",
      "The whole back curls up off the bench",
      "Given that this is a sit-up rather than a crunch, you will lift the entirety of your back up off the bench.",
      "thoracic.flex",
      12,
    ),
    checkJointRange(
      "hip-flexion",
      "Hips flex as the chest approaches the thighs",
      "Bring your chest toward your thighs as you tighten your abdominal muscles and drive the ribs toward the hip bones.",
      "hip_L.flex",
      16,
    ),
    checkJointWithinAt(
      "hands-behind-head",
      "Hands stay lightly beside the head",
      "Keep the fingertips lightly on the sides of the back of the head, with the elbows directed out away from the sides.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
    checkNeutralNeck(
      "You can keep the neck near a neutral position. If a scale were fixed to your head, it should not detect any force from the fingertips.",
      40,
    ),
  ],
});
