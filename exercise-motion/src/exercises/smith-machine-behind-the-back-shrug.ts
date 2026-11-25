import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Bar sits behind the glutes. Palms still face backward on an overhand grip. */
const GRIP = {
  "shoulder.elev": 16,
  "shoulder.plane": -8,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 2,
  "clavicle.prot": -4,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-behind-the-back-shrug",
  catalogId: "1a15c6f170d8801cac29f53975faddf2",
  name: "Smith Machine Behind-The-Back Shrug",
  defaultLoadKg: 5,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, heelZ: 0.1, smith: { stopY: 0.58 } },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.72, startZ: -0.02, endY: 0.84, endZ: -0.02 },
  },
  extraContacts: { bar: { pelvis: 0.04, thigh_L: 0.03, thigh_R: 0.03 } },
  stiffness: { elbow: 6, shoulder: 2.4, clavicle: 0.45, knee: 4, hip: 4, lumbar: 8, thoracic: 8 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...GRIP, "root.z": 0.02, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...GRIP, "root.z": 0.02, "clavicle.elev": 24 },
  },
  extraGoals: (body) => [pin(body, "sternum", () => new Vector3(0, 1.28, 0.12), 18, "z")],
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "clavicle_L.elev", -6, 46),
      lockAngle(body, "clavicle_R.elev", -6, 46),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
      lockAngle(body, "hip_L.flex", 4, 36),
      lockAngle(body, "hip_R.flex", 4, 36),
      lockAngle(body, "knee_L.flex", 4, 22),
      lockAngle(body, "knee_R.flex", 4, 22),
      lockAngle(body, "thoracic.flex", 0, 30),
      lockAngle(body, "lumbar.flex", 0, 30),
    ],
    end: [
      lockAngle(body, "hip_L.flex", 4, 36),
      lockAngle(body, "hip_R.flex", 4, 36),
      lockAngle(body, "clavicle_L.elev", 24, 46),
      lockAngle(body, "clavicle_R.elev", 24, 46),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
  }),
  checks: () => [
    checkFlatBack("Stand upright with the bar behind the glutes and the lower back near neutral.", 14),
    checkNeutralNeck("Keep the neck neutral, as when you are looking straight ahead."),
    checkJointWithinAt(
      "overhand",
      "Overhand grip behind the body",
      "Grasp the bar with a near shoulder-width overhand grip so the palms face backward.",
      "forearm_L.pron",
      "start",
      40,
      86,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Keep the elbows extended so the bar can rise behind you.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointRange(
      "shrug-rom",
      "Bar rises behind the glutes",
      "Shrug the shoulders up. If the glutes block the bar, stay a little farther forward of the rails.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
