import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/**
 * One plate in each hand, palms toward the thighs.
 * `plate` only builds a single shared prop, so each hand holds its own dumbbell-shaped plate stand-in.
 */
const DOWN = {
  "shoulder.elev": 12,
  "shoulder.plane": 32,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.elev": -6,
  "clavicle.prot": -2,
};

const UP = { ...DOWN, "clavicle.elev": 26, "elbow.flex": 12 };

export const spec = buildExerciseSpec({
  id: "plate-shrug",
  catalogId: "2ac5c6f170d880528867ff9573668f14",
  name: "Plate Shrug",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 5, shoulder: 2.4, clavicle: 0.45, knee: 3.5, lumbar: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...DOWN },
    end: { ...POSTURE_HINTS.standing, ...UP },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "clavicle_L.elev", -6, 48),
      lockAngle(body, "clavicle_R.elev", -6, 48),
      lockAngle(body, "elbow_L.flex", 10, 26),
      lockAngle(body, "elbow_R.flex", 10, 26),
      lockAngle(body, "knee_L.flex", 4, 24),
      lockAngle(body, "knee_R.flex", 4, 24),
    ],
    end: [
      lockAngle(body, "clavicle_L.elev", 26, 48),
      lockAngle(body, "clavicle_R.elev", 26, 48),
      lockAngle(body, "elbow_L.flex", 12, 26),
      lockAngle(body, "elbow_R.flex", 12, 26),
    ],
  }),
  checks: () => [
    checkFlatBack("Stand upright with straight legs and a braced torso.", 14),
    checkNeutralNeck("Look straight ahead and keep the neck near neutral."),
    checkJointWithinAt(
      "elbows-long",
      "Elbows stay nearly straight",
      "A little elbow bend is fine. Do not turn the shrug into an upright row.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "legs-still",
      "Legs stay straight",
      "Keep the knees straight while the plates travel straight up.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointRange(
      "shrug-rom",
      "Plates rise with the shrug",
      "Shrug the shoulders straight up toward the earlobes, then lower them fully.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
