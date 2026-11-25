import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 72,
  "shoulder.twist": 36,
  "elbow.flex": 8,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": -6,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 38,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "pause-smith-machine-bench-press",
  catalogId: "23b5c6f170d8809aa142f91210536839",
  name: "Pause Smith Machine Bench Press",
  defaultLoadKg: 36,
  loadUnit: "total",
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
    smith: { stopY: 0.52 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 0.98, startZ: -0.22, endY: 0.66, endZ: -0.18 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet planted while the bar pauses on the lower chest."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straight and the bar over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "chest-pause",
      "Bar pauses on the lower chest",
      "Hold the bar motionless on the lower chest before you press.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up after the pause",
      "Press the bar up the rails after the pause.",
      "press_L",
      "y",
      0.2,
    ),
  ],
});
