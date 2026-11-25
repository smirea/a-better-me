import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Vertical Smith rails through the lower chest. Moderate 1.5× grip, elbows 45–75° at the bottom. */
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
  id: "smith-machine-bench-press",
  catalogId: "1a05c6f170d88058a3a0c07e098a9605",
  name: "Smith Machine Bench Press",
  defaultLoadKg: 40,
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
    checkFeetPlanted("Drive the feet into the floor and keep the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out",
      "Finish with the elbows fully straightened and the bar over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "lower-chest",
      "Bar taps the lower chest",
      "Lower until the bar taps the lower chest, with the upper arms about 45–75° from the torso.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows bend and straighten",
      "Bend the elbows to lower the bar, then press until they are straight.",
      "elbow_L.flex",
      70,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up the rails",
      "Press the bar straight up off the lower chest.",
      "press_L",
      "y",
      0.2,
    ),
  ],
});
