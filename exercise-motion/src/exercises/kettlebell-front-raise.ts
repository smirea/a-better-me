import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Both hands on the horns, palms in, bell in front of the thighs. */
const DOWN = {
  "shoulder.elev": 22,
  "shoulder.plane": 84,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 68,
  "shoulder.plane": 74,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "kettlebell-front-raise",
  catalogId: "3315c6f170d880c3b12effad0524be67",
  name: "Kettlebell Front Raise",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Thighs"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
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
      "horns",
      "Palms face in on the horns",
      "Place one hand on each of the kettlebell’s horns with your palms facing in toward each other.",
      "forearm_L.pron",
      "start",
      -25,
      35,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Hold the kettlebell in front of your thighs with straight elbows.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Bell finishes at shoulder height",
      "At the top, your arms should be outstretched straight in front of you, parallel to the ground.",
      "shoulder_L.elev",
      "peak",
      55,
      90,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Sweep your arms forward and upward in an arcing manner to lift the kettlebell to approximately shoulder height.",
      "shoulder_L.elev",
      20,
    ),
  ],
});
