import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Overhand grip, bar just in front of the thighs, rails vertical. */
const GRIP = {
  "shoulder.elev": 14,
  "shoulder.plane": 72,
  "shoulder.twist": 14,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-shrug",
  catalogId: "1a15c6f170d8804cbd9afa04567bd5f7",
  name: "Smith Machine Shrug",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 6, smith: { stopY: 0.62 } },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.24,
    path: { startY: 0.72, startZ: 0.16, endY: 0.86, endZ: 0.16 },
  },
  stiffness: { elbow: 6, shoulder: 2.2, clavicle: 0.45, knee: 3.5, lumbar: 7 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...GRIP, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...GRIP, "clavicle.elev": 26 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "clavicle_L.elev", -6, 48),
      lockAngle(body, "clavicle_R.elev", -6, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
      lockAngle(body, "knee_L.flex", 4, 22),
      lockAngle(body, "knee_R.flex", 4, 22),
    ],
    end: [
      lockAngle(body, "clavicle_L.elev", 26, 48),
      lockAngle(body, "clavicle_R.elev", 26, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
  }),
  checks: () => [
    checkFlatBack("Stand upright with straight legs. The bar travels on the Smith rails.", 14),
    checkNeutralNeck("Look straight ahead and keep the neck near neutral."),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with a slightly outside shoulder-width overhand grip so the palms face backward.",
      "forearm_L.pron",
      "start",
      50,
      86,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Shrug with straight elbows. The rest of the body stays still.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointRange(
      "shrug-rom",
      "Bar rises with the shrug",
      "Drive the shoulders up toward the earlobes, then lower them fully.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
