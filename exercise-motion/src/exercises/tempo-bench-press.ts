import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
  
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 72,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 56,
  "shoulder.plane": -8,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "tempo-bench-press",
  catalogId: "2385c6f170d8809c92c2dcca404e1e91",
  name: "Tempo Bench Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Slow lower", "Pause"],
  tempo: { lower: 3.2, bottom: 1.6, raise: 0.85, top: 0.4 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
    rack: {  },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.12, startZ: -0.46, endY: 0.72, endZ: -0.26, arcBulgeZ: 0.04 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5, knee: 3 },
  
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while you press."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straightened and the bar over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "bottom",
      "Slow touch on the lower chest",
      "Take a few seconds to lower the bar, then pause on the lower chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up",
      "Press the bar up from the bottom of the rep.",
      "press_L",
      "y",
      0.22,
    ),
  ],
});
