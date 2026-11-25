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
  "shoulder.elev": 72,
  "shoulder.plane": 40,
  "shoulder.twist": 12,
  "elbow.flex": 36,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "lockout-pin-bench-press",
  catalogId: "2425c6f170d880eda736d987feaeb08b",
  name: "Lockout Pin Bench Press",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "On pins"],
  tempo: { lower: 0.8, bottom: 2, raise: 0.7, top: 0.4 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
    rack: { safetyY: 0.965 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.12, startZ: -0.46, endY: 0.98, endZ: -0.42, arcBulgeZ: 0.04 },
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
      "Bar stops on the lockout pins",
      "The pins catch the bar in the top third of the press, a short lockout range.",
      "elbow_L.flex",
      "peak",
      18,
      55,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up",
      "Press the bar up from the bottom of the rep.",
      "press_L",
      "y",
      0.06,
    ),
  ],
});
