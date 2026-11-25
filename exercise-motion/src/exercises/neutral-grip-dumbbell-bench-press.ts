import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/** Palms face each other and the upper arms stay near a 30° tuck. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 58,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 2,
  "wrist.flex": -4,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 62,
  "shoulder.plane": 28,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 4,
  "wrist.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-dumbbell-bench-press",
  catalogId: "1a05c6f170d880a6b539ef74691f8c75",
  name: "Neutral Grip Dumbbell Bench Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Tucked"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "dumbbells",
    anchor: "press",
    handPath: { start: [0.26, 1.12, -0.44], end: [0.28, 0.84, -0.32] },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.75, elbow: 4, forearm: 3, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while you press."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the arms up and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      34,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms stay facing each other",
      "Keep a neutral grip, palms in, through the press.",
      "forearm_L.pron",
      "peak",
      -18,
      22,
    ),
    checkJointWithinAt(
      "bottom",
      "Elbows stay tucked",
      "Lower with the upper arms near a 30-degree angle to the torso.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up",
      "Press up without flaring the elbows like a standard dumbbell bench press.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
