import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Both hands pinch the plate sides, palms in, elbows and wrists straight. */
const DOWN = {
  "shoulder.elev": 20,
  "shoulder.plane": 86,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 80,
  "shoulder.plane": 76,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "plate-front-raise",
  catalogId: "2955c6f170d88026baf6d53c5bd19bc3",
  name: "Plate Front Raise",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Thighs"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "plate", twoHandsOnOne: true },
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
      "palms-in",
      "Palms face in on the plate",
      "Pick up the sides of a weight plate with both hands as your palms are facing in toward each other.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your elbows straight throughout the set.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Plate finishes parallel to the ground",
      "Raise the plate out in front of you until your arms are approximately parallel to the ground.",
      "shoulder_L.elev",
      "peak",
      64,
      100,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Raise the plate out in front of you, then lower it until it is directly in front of your legs.",
      "shoulder_L.elev",
      48,
    ),
  ],
});
