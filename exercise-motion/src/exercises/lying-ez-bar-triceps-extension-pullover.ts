import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Lying EZ-bar extension with a pullover phase (option 2).
 * Elbows travel behind the head as the shoulders flex, unlike a skull crusher.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -6,
  "clavicle.elev": 6,
};

export const spec = buildExerciseSpec({
  id: "lying-ez-bar-triceps-extension-pullover",
  catalogId: "24c5c6f170d880d09637e940efe3e542",
  name: "Lying EZ Bar Triceps Extension Pullover",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Behind head", "Pull over", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.5, top: 0.4 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.22,
    anchor: "press",
    alignWrists: false,
  },
  extraContacts: { bar: { head: 0.08, neck: 0.05 } },
  stiffness: { shoulder: 0.7, elbow: 2.4, lumbar: 5, thoracic: 5 },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "shoulder_L.elev", 90, 36),
      lockAngle(body, "shoulder_R.elev", 90, 36),
      lockAngle(body, "elbow_L.flex", 8, 24),
      lockAngle(body, "elbow_R.flex", 8, 24),
    ],
    end: [
      lockAngle(body, "shoulder_L.elev", 138, 28),
      lockAngle(body, "shoulder_R.elev", 138, 28),
      lockAngle(body, "elbow_L.flex", 108, 22),
      lockAngle(body, "elbow_R.flex", 108, 22),
    ],
  }),
  hints: {
    start: {
      ...TRUNK,
      "shoulder.elev": 94,
      "shoulder.plane": 24,
      "shoulder.twist": 8,
      "elbow.flex": 6,
      "forearm.pron": 40,
      "wrist.flex": 2,
      "clavicle.elev": 8,
    },
    end: {
      ...TRUNK,
      "shoulder.elev": 148,
      "shoulder.plane": 78,
      "shoulder.twist": 4,
      "elbow.flex": 108,
      "forearm.pron": 40,
      "wrist.flex": 4,
      "clavicle.elev": 16,
      "neck.flex": 12,
    },
  },
  checks: () => [
    checkFeetPlanted("Keep the feet on the floor with the knees bent."),
    checkJointWithinAt(
      "elbows-locked",
      "Arms start vertical",
      "Start with the elbows straight and the bar vertically above the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows bend behind the head",
      "Lower the bar behind the head by bending the elbows while the elbows themselves travel backward.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkJointRange(
      "shoulder-pullover",
      "Shoulders travel into the pullover",
      "Continue lowering through shoulder motion so the bar passes behind the head, unlike a skull crusher.",
      "shoulder_L.elev",
      28,
    ),
    checkJointWithinAt(
      "behind-head",
      "Upper arms finish behind the head",
      "Set the head near the edge of the bench and lower through the shoulder range a pullover uses.",
      "shoulder_L.elev",
      "bottom",
      100,
      175,
    ),
  ],
});
