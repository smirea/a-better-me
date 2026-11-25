import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Semi-overhand grip on the EZ camber, same straight-arm front raise as the straight bar. */
const DOWN = {
  "shoulder.elev": 16,
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 42,
  "wrist.flex": 2,
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
  id: "ez-bar-front-raise",
  catalogId: "38f5c6f170d88040b88ffa81bdea9507",
  name: "EZ Bar Front Raise",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Thighs"],
  tempo: { lower: 1.7, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.18,
    alignWrists: false,
  },
  stiffness: { elbow: 6, shoulder: 0.7, lumbar: 8, thoracic: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...DOWN },
    end: { ...POSTURE_HINTS.standing, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "All the movement should occur from shoulder motion while you keep your legs and torso stationary throughout the exercise.",
    ),
    checkJointWithinAt(
      "semi-overhand",
      "Semi-overhand grip",
      "Grasp the EZ bar with your palms angled backward and in toward each other as your hands are about shoulder width apart.",
      "forearm_L.pron",
      "start",
      20,
      70,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "While keeping your elbows straight, sweep your arms forward and upward.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Bar finishes at shoulder height",
      "At the top, your arms should be outstretched straight in front of you, parallel to the ground.",
      "shoulder_L.elev",
      "peak",
      64,
      112,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Sweep your arms forward and upward in an arcing manner to lift the bar to approximately shoulder height.",
      "shoulder_L.elev",
      50,
    ),
  ],
});
