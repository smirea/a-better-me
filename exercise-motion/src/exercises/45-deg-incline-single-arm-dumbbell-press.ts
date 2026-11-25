import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.62,
  "root.z": -0.18,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 10,
  "clavicle.prot": -14,
  "clavicle.elev": 2,
};

const PRESS_TOP = {
  "shoulder.elev": 116,
  "shoulder.plane": 70,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
};

const PRESS_BOTTOM = {
  "shoulder.elev": 66,
  "shoulder.plane": 8,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
};

const FREE = {
  "shoulder.elev": 36,
  "shoulder.plane": 28,
  "shoulder.twist": 6,
  "elbow.flex": 96,
  "forearm.pron": 16,
  "wrist.flex": 4,
  "clavicle.prot": -6,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "45-deg-incline-single-arm-dumbbell-press",
  catalogId: "1a05c6f170d8805b9dd1f99907b00278",
  name: "45° Incline Single Arm Dumbbell Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Upper chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.25, top: 0.5 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 45,
    stanceX: 0.2,
    heelZ: 0.48,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: {
    start: { ...TRUNK, ...PRESS_TOP, ...sidedHints("R", FREE, {}) },
    end: { ...TRUNK, ...PRESS_BOTTOM, ...sidedHints("R", FREE, {}) },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor under the bent knees."),
    checkJointWithinAt(
      "elbow-locked",
      "Working elbow locked out",
      "Finish with the working arm directed up the incline.",
      "elbow_L.flex",
      "start",
      0,
      62,
    ),
    checkJointWithinAt(
      "upper-chest",
      "Dumbbell meets the upper chest",
      "Lower the working dumbbell toward the upper chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbell-rises",
      "Dumbbell travels up",
      "Press the single dumbbell up from the upper chest.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
