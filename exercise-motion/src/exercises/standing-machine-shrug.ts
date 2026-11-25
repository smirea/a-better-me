import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Y, box, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Neutral handles beside the hips. The stack sits behind the lifter. */
const DOWN = {
  "shoulder.elev": 12,
  "shoulder.plane": 24,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": 0,
  "clavicle.elev": -6,
  "clavicle.prot": -2,
};

const UP = { ...DOWN, "clavicle.elev": 26 };

export const spec = buildExerciseSpec({
  id: "standing-machine-shrug",
  catalogId: "1a15c6f170d880129623ecf7b410009b",
  name: "Standing Machine Shrug",
  defaultLoadKg: 30,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, heelZ: 0.04 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, -1, 0],
    gripX: 0.28,
  },
  extraEquipment: [
    box("shrug.base", [0, 0.04, -0.48], [0.95, 0.08, 0.55], "steel", false),
    box("shrug.stack", [0, 0.72, -0.72], [0.32, 1.15, 0.2], "plate", false),
    cylinder("shrug.postL", [0.46, 0.7, -0.18], 0.03, 1.35, "steel", ALONG_Y, false),
    cylinder("shrug.postR", [-0.46, 0.7, -0.18], 0.03, 1.35, "steel", ALONG_Y, false),
  ],
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
    ],
    end: [
      lockAngle(body, "clavicle_L.elev", 26, 48),
      lockAngle(body, "clavicle_R.elev", 26, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
  }),
  checks: () => [
    checkFlatBack("Stand tall between the handles with the lower back near neutral.", 14),
    checkNeutralNeck("Keep the neck neutral while the handles travel straight up."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Grasp the handles with a neutral grip and keep the elbows extended.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Shrug until the shoulders are up toward the ears.",
      "clavicle_L.elev",
      "peak",
      16,
      34,
    ),
    checkJointRange(
      "shrug-rom",
      "Handles rise with the shrug",
      "Elevate the shoulders, then let them descend a little below resting height.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
