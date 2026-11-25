import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.14,
  "root.z": 0.02,
  "root.pitch": -78,
  "lumbar.flex": 12,
  "thoracic.flex": 16,
  "neck.flex": 14,
  "hip.abd": 8,
  "ankle.dorsi": 0,
};

/** Hands lightly at the sides of the head, elbows wide. */
const HANDS = {
  "shoulder.elev": 80,
  "shoulder.plane": 40,
  "shoulder.twist": 24,
  "elbow.flex": 100,
  "forearm.pron": 8,
  "wrist.flex": 6,
};

const START = {
  ...TRUNK,
  ...HANDS,
  "hip.flex": 28,
  "knee.flex": 18,
  "thoracic.twist": 0,
  "lumbar.twist": 0,
};

/** Left peak: right knee marches in, left leg extends, chest rotates toward the right knee. */
const PEAK = sidedHints(
  "L",
  {
    "hip.flex": 18,
    "knee.flex": 8,
    "shoulder.elev": 82,
    "shoulder.plane": 36,
    "elbow.flex": 100,
  },
  {
    "hip.flex": 108,
    "knee.flex": 105,
    "shoulder.elev": 78,
    "shoulder.plane": 48,
    "elbow.flex": 100,
  },
  {
    ...TRUNK,
    ...HANDS,
    "thoracic.twist": -22,
    "lumbar.twist": -6,
    "thoracic.bend": -6,
    "thoracic.flex": 22,
  },
);

export const spec = buildExerciseSpec({
  id: "bicycle-crunch",
  catalogId: "1a45c6f170d8801ea5f2d12645db5418",
  name: "Bicycle Crunch",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Set", "Rotate", "Switch", "Rotate"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "elbow", "forearm", "wrist"],
  },
  apparatus: { kind: "none" },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkJointRange(
      "knee-march",
      "One knee marches toward the chest",
      "March one leg up and back toward your chest while bending its knee as you lower the other leg with a straight knee.",
      "knee_L.flex",
      50,
    ),
    checkJointRange(
      "hip-march",
      "Hips flex and extend reciprocally",
      "Move your legs reciprocally at the same speed in sync with your torso rotation.",
      "hip_L.flex",
      50,
    ),
    checkJointRange(
      "trunk-rotation",
      "Chest rotates toward the marching knee",
      "Rotate your chest to bring the opposite elbow toward the marching knee. If your chest does not turn, you are not rotating your torso.",
      "thoracic.twist",
      16,
    ),
    checkJointWithinAt(
      "low-back-flat",
      "Lower back stays flattened",
      "Tighten your abs to flatten your lower back and press it lightly into the ground, and keep it flattened throughout.",
      "lumbar.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-stay-wide",
      "Elbows stay out rather than pulling the head",
      "Place the fingertips of each hand lightly on the sides of the back of your head, with your elbows directed out away from your sides.",
      "elbow_L.flex",
      "peak",
      70,
      130,
    ),
  ],
});
