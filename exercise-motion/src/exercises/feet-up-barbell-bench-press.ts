import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
  "hip.flex": 8, "hip.abd": 3, "knee.flex": 6, "ankle.dorsi": -6,
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
  id: "feet-up-barbell-bench-press",
  catalogId: "1a05c6f170d88064bb2ede3eb9413258",
  name: "Feet-Up Barbell Bench Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.15, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: false,
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
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 28),
    lockAngle(body, "knee_R.flex", 6, 28),
  ],
  checks: () => [
    
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
      "Bar meets the lower chest",
      "Press with the knees straight and both feet off the floor.",
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
