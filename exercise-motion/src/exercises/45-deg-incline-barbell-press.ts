import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Moderate incline: torso ~45° from horizontal, standard 1.5× grip, bar to the upper chest. */
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
  "shoulder.elev": 118,
  "shoulder.plane": 72,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 68,
  "shoulder.plane": 8,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "45-deg-incline-barbell-press",
  catalogId: "1a05c6f170d880198e1aceac084f30eb",
  name: "45° Incline Barbell Press",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Upper chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.25, top: 0.55 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 45,
    stanceX: 0.2,
    heelZ: 0.48,
    feetOnFloor: true,
    rack: {},
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.42, startZ: -0.32, endY: 0.94, endZ: -0.1, arcBulgeZ: 0.04 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor, about shoulder width, with the knees bent."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows fully straightened and the bar above the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      18,
    ),
    checkJointWithinAt(
      "upper-chest",
      "Bar meets the upper chest",
      "Lower the bar until it taps the upper chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders move through the incline press",
      "The press combines shoulder flexion and horizontal flexion.",
      "shoulder_L.elev",
      25,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up from the chest",
      "Press the bar up until the elbows are straight.",
      "press_L",
      "y",
      0.22,
    ),
  ],
});
