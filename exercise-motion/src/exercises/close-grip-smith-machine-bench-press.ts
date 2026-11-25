import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/** Shoulder-width grip. Elbows stay tucked near 30–45° from the torso at the bottom. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 48,
  "shoulder.twist": 34,
  "elbow.flex": 8,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 54,
  "shoulder.plane": 28,
  "shoulder.twist": 14,
  "elbow.flex": 118,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "close-grip-smith-machine-bench-press",
  catalogId: "23b5c6f170d8807fbea3e916bac10cfc",
  name: "Close Grip Smith Machine Bench Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Lower chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.55 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
    smith: { stopY: 0.5 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.22,
    anchor: "press",
    path: { startY: 1.04, startZ: 0, endY: 0.64, endZ: 0 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.75, elbow: 4.5, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Drive the feet into the floor and keep the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out",
      "Press until the elbows are fully straightened.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbows stay tucked on the lower chest",
      "Keep the elbows near the sides so the upper arms finish about 30–45° from the torso.",
      "elbow_L.flex",
      "peak",
      95,
      135,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up the rails",
      "Press the bar up from the lower chest.",
      "press_L",
      "y",
      0.2,
    ),
  ],
});
