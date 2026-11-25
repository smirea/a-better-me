import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 72,
  "shoulder.twist": 36,
  "elbow.flex": 6,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": -8,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 38,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "pause-barbell-bench-press",
  catalogId: "19f5c6f170d88013ae78cc9e6c967813",
  name: "Pause Barbell Bench Press",
  defaultLoadKg: 45,
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
    rack: {},
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.12, startZ: -0.46, endY: 0.72, endZ: -0.26, arcBulgeZ: 0.05 },
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
      20,
    ),
    checkJointWithinAt(
      "chest-pause",
      "Paused on the chest",
      "Pause with the bar touching the lower chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders press through a full arc",
      "Lower to the chest, pause, then press back to lockout.",
      "shoulder_L.elev",
      20,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar leaves the chest",
      "Press the bar up off the paused chest position.",
      "press_L",
      "y",
      0.25,
    ),
  ],
});
