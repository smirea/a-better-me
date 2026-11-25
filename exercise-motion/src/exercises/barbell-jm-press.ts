import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * JM press: close-grip press mixed with a triceps extension.
 * Elbows stay higher than a bench press and the bar finishes toward the chin, forearms near horizontal.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "clavicle.prot": -12,
  "clavicle.elev": 2,
};

const ARMS_TOP = {
  "shoulder.elev": 96,
  "shoulder.plane": 36,
  "shoulder.twist": 22,
  "elbow.flex": 6,
  "forearm.pron": 68,
  "wrist.flex": -4,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 74,
  "shoulder.plane": 18,
  "shoulder.twist": 16,
  "elbow.flex": 118,
  "forearm.pron": 62,
  "wrist.flex": 10,
};

export const spec = buildExerciseSpec({
  id: "barbell-jm-press",
  catalogId: "1a15c6f170d88095b3fbfacf899488e7",
  name: "Barbell JM Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Chin", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.3, top: 0.45 },
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
    style: "straight",
    gripX: 0.22,
    anchor: "press",
    alignWrists: false,
    path: { startY: 1.06, startZ: -0.32, endY: 0.8, endZ: -0.5, arcBulgeZ: -0.02 },
  },
  extraContacts: { bar: { head: 0.05, neck: 0.045, chest: 0.03 } },
  stiffness: { shoulder: 0.85, elbow: 3.2, lumbar: 5, thoracic: 5, knee: 3 },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  checks: () => [
    checkFeetPlanted(
      "Keep the feet dug into the floor, with the buttocks, upper back, and head planted on the bench.",
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out over the shoulders",
      "Finish with the elbows fully straightened and the bar above the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "chin",
      "Bar lowers toward the chin",
      "Lower the bar toward the throat or chin until the elbows are deeply bent and the forearms are closer to horizontal than vertical.",
      "elbow_L.flex",
      "bottom",
      95,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend the JM press",
      "Straighten the elbows to lift the bar back above the shoulders.",
      "elbow_L.flex",
      80,
    ),
    checkJointWithinAt(
      "elbows-stay-high",
      "Elbows stay higher than a close-grip press",
      "Keep the elbows higher than the chest. Drop them less than you would on a close-grip bench press.",
      "shoulder_L.elev",
      "bottom",
      60,
      100,
    ),
    checkAnchorTravel(
      "bar-drops-toward-chin",
      "Bar travels toward the chin",
      "The bar tracks slightly backward toward the face, less than a strict skull crusher.",
      "press_L",
      "z",
      0.08,
    ),
  ],
});
