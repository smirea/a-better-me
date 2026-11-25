import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const PRESS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 74,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const PRESS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 38,
  "wrist.flex": -8,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

/** Free hand rests across the lower chest and steadies the torso. */
const FREE = {
  "shoulder.elev": 32,
  "shoulder.plane": 36,
  "shoulder.twist": 8,
  "elbow.flex": 100,
  "forearm.pron": 18,
  "wrist.flex": 4,
  "clavicle.prot": -8,
  "clavicle.elev": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-bench-press",
  catalogId: "1a05c6f170d8803dad22e04308bd0a98",
  name: "Single Arm Dumbbell Bench Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: {
    start: { ...TRUNK, ...sidedHints("L", PRESS_TOP, FREE) },
    end: { ...TRUNK, ...sidedHints("L", PRESS_BOTTOM, FREE) },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while the free arm stabilizes."),
    checkJointWithinAt(
      "elbow-locked",
      "Working elbow locked out",
      "Finish with the working arm straight and the dumbbell over that shoulder.",
      "elbow_L.flex",
      "start",
      0,
      34,
    ),
    checkJointWithinAt(
      "bottom",
      "Dumbbell meets the side of the chest",
      "Lower the working arm toward the side of the chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointWithinAt(
      "free-arm",
      "Free arm stays in to stabilize",
      "The arm without a dumbbell stays bent across the torso.",
      "elbow_R.flex",
      "peak",
      70,
      130,
    ),
    checkAnchorTravel(
      "dumbbell-rises",
      "Dumbbell travels up",
      "Press the single dumbbell up from the chest.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
