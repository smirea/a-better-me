import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * JM press on a Smith bar: elbows stay higher than a close-grip bench,
 * and the bar finishes over the chin with the forearms near horizontal.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "clavicle.prot": -14,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 74,
  "shoulder.plane": 52,
  "shoulder.twist": 28,
  "elbow.flex": 10,
  "forearm.pron": 68,
  "wrist.flex": -4,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 52,
  "shoulder.plane": 38,
  "shoulder.twist": 16,
  "elbow.flex": 108,
  "forearm.pron": 74,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-jm-press",
  catalogId: "2a15c6f170d880688ba8f6c9a4bfb59b",
  name: "Smith Machine JM Press",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chin"],
  tempo: { lower: 1.8, bottom: 0.2, raise: 1.2, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
    smith: { stopY: 0.72 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.22,
    anchor: "press",
  },
  stiffness: { shoulder: 1.1, elbow: 4, lumbar: 6, thoracic: 6, clavicle: 3.5, wrist: 3 },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  checks: () => [
    checkFeetPlanted("Drive the feet into the floor and keep the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out",
      "Finish each rep with the elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "chin",
      "Bar finishes toward the chin",
      "Lower until the elbows are fully bent or the bar is just short of the chin, with the elbows still above the chest.",
      "elbow_L.flex",
      "bottom",
      90,
      130,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows do most of the work",
      "Straighten the elbows to lift the bar. The shoulders move less than in a close-grip bench press.",
      "elbow_L.flex",
      75,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up off the chin line",
      "Press the bar up from the bottom of the rep.",
      "press_L",
      "y",
      0.12,
    ),
  ],
});
