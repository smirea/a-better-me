import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
  
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 48,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 56,
  "shoulder.plane": 28,
  "shoulder.twist": 12,
  "elbow.flex": 118,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "pause-close-grip-bench-press",
  catalogId: "2375c6f170d88097a709c94ec5d3e9fc",
  name: "Pause Close Grip Bench Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 2, bottom: 2, raise: 1.15, top: 0.45 },
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
    gripX: 0.22,
    anchor: "press",
    path: { startY: 1.02, startZ: -0.4, endY: 0.72, endZ: -0.24, arcBulgeZ: 0.04 },
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
      42,
    ),
    checkJointWithinAt(
      "bottom",
      "Paused close-grip on the chest",
      "Pause about two seconds with the bar on the lower chest and the elbows tucked.",
      "elbow_L.flex",
      "peak",
      90,
      135,
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
