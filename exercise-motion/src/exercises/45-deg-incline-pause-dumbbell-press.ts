import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.62,
  "root.z": -0.18,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 10,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
};

const ARMS_TOP = {
  "shoulder.elev": 116,
  "shoulder.plane": 70,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 66,
  "shoulder.plane": 8,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "45-deg-incline-pause-dumbbell-press",
  catalogId: "1a05c6f170d88001a638d8c959467497",
  name: "45° Incline Pause Dumbbell Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 2, bottom: 2, raise: 1.2, top: 0.45 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 45,
    stanceX: 0.2,
    heelZ: 0.48,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet planted through the pause on the upper chest."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the arms directed up the incline.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "pause",
      "Paused on the upper chest",
      "Pause about two seconds with the dumbbells at the bottom.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up after the pause",
      "Press up from a dead stop at the upper chest.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
