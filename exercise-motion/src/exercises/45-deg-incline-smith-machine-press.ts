import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.62,
  "root.z": -0.12,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 10,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
};

const ARMS_TOP = {
  "shoulder.elev": 116,
  "shoulder.plane": 70,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 70,
  "shoulder.plane": 10,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "45-deg-incline-smith-machine-press",
  catalogId: "1a05c6f170d880ccbf5aeb7f1b3fcee5",
  name: "45° Incline Smith Machine Press",
  defaultLoadKg: 32,
  loadUnit: "total",
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
    smith: { stopY: 0.78 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.38, startZ: 0, endY: 0.96, endZ: 0 },
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
      22,
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
      "Bar travels up the rails",
      "Press the bar up until the elbows are straight.",
      "press_L",
      "y",
      0.18,
    ),
  ],
});
