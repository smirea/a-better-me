import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 74,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 38,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "pause-dumbbell-bench-press",
  catalogId: "1a05c6f170d88017acc8c48b6ccdd639",
  name: "Pause Dumbbell Bench Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 2, bottom: 2, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet planted while the dumbbells pause by the chest."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straight and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      34,
    ),
    checkJointWithinAt(
      "chest-pause",
      "Paused by the chest",
      "Pause about two seconds with the dumbbells at the bottom.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up after the pause",
      "Press up from a dead stop at the chest.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
