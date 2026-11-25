import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Overhand grip, bar in front of the thighs, then straight out at shoulder height. */
const DOWN = {
  "shoulder.elev": 16,
  "shoulder.plane": 84,
  "shoulder.twist": 14,
  "elbow.flex": 6,
  "forearm.pron": 74,
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
  id: "barbell-front-raise",
  catalogId: "2965c6f170d880f8b368e35f599819f7",
  name: "Barbell Front Raise",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Thighs"],
  tempo: { lower: 1.7, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
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
      "overhand",
      "Overhand grip",
      "Grasp the bar with your hands approximately shoulder width apart and your palms facing back toward you.",
      "forearm_L.pron",
      "start",
      50,
      86,
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
      70,
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
