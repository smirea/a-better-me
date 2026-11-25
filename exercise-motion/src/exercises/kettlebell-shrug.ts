import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Bells hang beside the thighs, horns in a neutral grip. */
const DOWN = {
  "shoulder.elev": 12,
  "shoulder.plane": 32,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 4,
  "wrist.flex": 2,
  "clavicle.elev": -6,
  "clavicle.prot": -2,
};

const UP = { ...DOWN, "clavicle.elev": 26, "shoulder.elev": 14 };

export const spec = buildExerciseSpec({
  id: "kettlebell-shrug",
  catalogId: "1a15c6f170d880b2b06cf95892f97c0b",
  name: "Kettlebell Shrug",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 8 },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: true },
  stiffness: { elbow: 6, shoulder: 2.4, clavicle: 0.45, knee: 3.5, lumbar: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...DOWN },
    end: { ...POSTURE_HINTS.standing, ...UP },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "clavicle_L.elev", -6, 48),
      lockAngle(body, "clavicle_R.elev", -6, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
      lockAngle(body, "knee_L.flex", 4, 24),
      lockAngle(body, "knee_R.flex", 4, 24),
    ],
    end: [
      lockAngle(body, "clavicle_L.elev", 26, 48),
      lockAngle(body, "clavicle_R.elev", 26, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
  }),
  checks: () => [
    checkFlatBack("Stand upright. The kettlebells rise only because the shoulders shrug.", 14),
    checkNeutralNeck("Keep the neck neutral, as when you are looking straight ahead."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Hold the kettlebells at your sides with extended elbows and palms facing the thighs.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "legs-still",
      "Legs stay straight",
      "Keep the knees and hips nearly straight for the whole set.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointRange(
      "shrug-rom",
      "Scapulae elevate and depress",
      "Shrug the shoulders up, then let them sink a little below resting height.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
