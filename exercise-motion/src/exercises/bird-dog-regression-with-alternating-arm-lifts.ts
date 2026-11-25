import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, lockAngle, pin } from "../solver";

const ALL_FOURS = {
  "root.y": 0.48,
  "root.z": 0,
  "root.pitch": 78,
  "lumbar.flex": 8,
  "thoracic.flex": 6,
  "neck.flex": 4,
  "hip.flex": 88,
  "hip.abd": 8,
  "knee.flex": 92,
  "ankle.dorsi": 18,
  "clavicle.prot": 8,
  "forearm.pron": 74,
  "wrist.flex": 30,
};

const DOWN_ARM = {
  "shoulder.elev": 64,
  "shoulder.plane": 84,
  "shoulder.twist": 6,
  "elbow.flex": 8,
};

const REACH = {
  "shoulder.elev": 125,
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "elbow.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "bird-dog-regression-with-alternating-arm-lifts",
  catalogId: "1f55c6f170d880bba135e69b2b1a910b",
  name: "Bird Dog Regression With Alternating Arm Lifts",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Set", "Reach", "Return", "Switch"],
  tempo: { lower: 1.6, bottom: 0.5, raise: 1.6, top: 0.4 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 1.8, 0),
  extraGoals: (body) => [
    pin(body, "kneeFront_L", () => new Vector3(0.12, 0.08, -0.02), 42),
    pin(body, "kneeFront_R", () => new Vector3(-0.12, 0.08, -0.02), 42),
    keepAbove(body, "ballIn_L", 0.05, 36),
    keepAbove(body, "ballIn_R", 0.05, 36),
    keepAbove(body, "palmFlat_L", 0.06, 18),
    keepAbove(body, "palmFlat_R", 0.06, 18),
    keepAbove(body, "toe_L", 0.04, 30),
    keepAbove(body, "toe_R", 0.04, 30),
    lockAngle(body, "ankle_L.dorsi", 16, 24),
    lockAngle(body, "ankle_R.dorsi", 16, 24),
  ],
  stiffness: { lumbar: 14, thoracic: 12, hip: 8, knee: 8, shoulder: 10, elbow: 6 },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("L", DOWN_ARM, DOWN_ARM, ALL_FOURS),
    end: sidedHints("L", REACH, DOWN_ARM, ALL_FOURS),
  },
  checks: () => [
    checkFlatBack("Brace the trunk so the chest keeps facing the floor while one arm reaches.", 12),
    checkNeutralNeck("Keep the neck near neutral."),
    checkJointRange(
      "arm-reach",
      "One arm reaches forward",
      "Sweep one arm forward and lift it only as high as the trunk stays still.",
      "shoulder_L.elev",
      40,
    ),
    checkJointWithinAt(
      "other-arm-down",
      "The other hand stays down",
      "Keep the supporting hand on the floor.",
      "shoulder_R.elev",
      "peak",
      48,
      110,
    ),
    checkJointWithinAt(
      "hips-still",
      "Both knees stay down",
      "Keep both thighs pointing down. Only the arm moves.",
      "hip_L.flex",
      "peak",
      70,
      110,
    ),
  ],
});
