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
  "shoulder.plane": 52,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": -4,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 70,
  "shoulder.plane": 24,
  "shoulder.twist": 4,
  "elbow.flex": 106,
  "forearm.pron": 4,
  "wrist.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "45-deg-incline-neutral-grip-dumbbell-press",
  catalogId: "1a05c6f170d88039bf25fdc502f1fb53",
  name: "45° Incline Neutral Grip Dumbbell Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral",
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
  apparatus: {
    kind: "dumbbells",
    anchor: "press",
    handPath: { start: [0.24, 1.46, -0.24], end: [0.28, 1.08, -0.08] },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.75, elbow: 4, forearm: 3, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor under the bent knees."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the arms up and the palms still facing each other.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms stay facing each other",
      "Keep a neutral grip on the incline.",
      "forearm_L.pron",
      "peak",
      -18,
      22,
    ),
    checkJointWithinAt(
      "upper-chest",
      "Dumbbells meet the upper chest",
      "Lower with the elbows tucked, toward the upper chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up",
      "Press up the incline without flaring the elbows wide.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
