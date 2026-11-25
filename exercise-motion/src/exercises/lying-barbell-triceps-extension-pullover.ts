import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Straight-bar version of the lying extension-pullover. Elbows travel behind the head. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -6,
  "clavicle.elev": 6,
};

export const spec = buildExerciseSpec({
  id: "lying-barbell-triceps-extension-pullover",
  catalogId: "24e5c6f170d880ec9400e968c0a2f1ee",
  name: "Lying Barbell Triceps Extension Pullover",
  defaultLoadKg: 14,
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
    style: "straight",
    gripX: 0.2,
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
      "shoulder.plane": 22,
      "shoulder.twist": 10,
      "elbow.flex": 6,
      "forearm.pron": 70,
      "wrist.flex": 2,
      "clavicle.elev": 8,
    },
    end: {
      ...TRUNK,
      "shoulder.elev": 148,
      "shoulder.plane": 78,
      "shoulder.twist": 6,
      "elbow.flex": 108,
      "forearm.pron": 70,
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
      "Bend the elbows while moving them backward so the bar travels behind the head.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkJointRange(
      "shoulder-pullover",
      "Shoulders travel into the pullover",
      "The elbows arc backward through shoulder extension as well as elbow flexion.",
      "shoulder_L.elev",
      28,
    ),
    {
      id: "overhand-grip",
      label: "Near shoulder-width overhand grip",
      cue: "Grasp the bar with a near shoulder-width overhand grip so the palms face back toward you.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 70),
          28,
          "° off an overhand grip",
        ),
    },
  ],
});
