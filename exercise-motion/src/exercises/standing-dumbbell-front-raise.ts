import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral grip at the sides, then both bells straight out to shoulder height. */
const DOWN = {
  "shoulder.elev": 14,
  "shoulder.plane": 58,
  "shoulder.twist": 2,
  "elbow.flex": 6,
  "forearm.pron": 2,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 90,
  "shoulder.plane": 84,
  "forearm.pron": 6,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-front-raise",
  catalogId: "1a15c6f170d880b987dfef02305048b6",
  name: "Standing Dumbbell Front Raise",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Sides"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, shoulder: 0.7, lumbar: 8, thoracic: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...DOWN },
    end: { ...POSTURE_HINTS.standing, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "Brace your core and keep the legs and torso still while the arms raise.",
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Hold the dumbbells at your sides with extended elbows as your palms face in toward your sides.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Stand upright while holding the dumbbells at your sides with extended elbows.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Upper arms finish parallel to the floor",
      "Raise the dumbbells out in front of you until your upper arms are approximately parallel with the ground.",
      "shoulder_L.elev",
      "peak",
      70,
      115,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "Raise the dumbbells out in front of you, then lower them in a controlled manner back to your sides.",
      "shoulder_L.elev",
      50,
    ),
  ],
});
