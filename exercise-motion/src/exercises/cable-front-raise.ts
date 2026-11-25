import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low pulley behind the heels; a short hip hinge keeps the stack separated. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 8,
  "hip.flex": 14,
  "knee.flex": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

const DOWN = {
  "shoulder.elev": 18,
  "shoulder.plane": 82,
  "shoulder.twist": 14,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 90,
  "shoulder.plane": 86,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "cable-front-raise",
  catalogId: "2965c6f170d880fcbe4ef2971006df0a",
  name: "Cable Front Raise",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Thighs"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, heelZ: 0.28, torsoLeanDeg: 8, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.28, 0],
    columnPos: [0, -0.35],
    facingDir: 1,
    attachment: "straight-bar",
    gripX: 0.2,
  },
  stiffness: { elbow: 6, shoulder: 0.7, lumbar: 8, thoracic: 7 },
  hints: {
    start: { ...TRUNK, ...DOWN },
    end: { ...TRUNK, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "While your arm moves from motion at your shoulders, your legs and torso should remain stationary throughout your set.",
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip on the bar",
      "Grasp the straight bar with a near shoulder width overhand grip as your palms are facing backward.",
      "forearm_L.pron",
      "start",
      48,
      86,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "While keeping your elbows straight, sweep your arms forward and upward in an arcing manner.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Arms finish parallel to the ground",
      "Sweep your arms until they are approximately parallel to the ground, outstretched in front of you.",
      "shoulder_L.elev",
      "peak",
      70,
      112,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Allow your shoulder blades to move naturally rather than trying to keep them in any particular position.",
      "shoulder_L.elev",
      50,
    ),
  ],
});
