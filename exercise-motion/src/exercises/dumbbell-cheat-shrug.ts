import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Neutral hang. A small knee dip adds drive into the shrug. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 30,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-cheat-shrug",
  catalogId: "2a05c6f170d88072a129d4b65dfd9a53",
  name: "Dumbbell Cheat Shrug",
  defaultLoadKg: 24,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Dip", "Drive", "Lower", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 0.55, top: 0.2 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8 },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, shoulder: 2.2, clavicle: 0.45, lumbar: 6, knee: 0.7, hip: 0.7 },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.9,
      "root.pitch": 6,
      "hip.flex": 18,
      "knee.flex": 22,
      "ankle.dorsi": 6,
      "lumbar.flex": 2,
      "clavicle.elev": -6,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.pitch": 0,
      "hip.flex": 4,
      "knee.flex": 4,
      "clavicle.elev": 26,
    },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "knee_L.flex", 22, 28),
      lockAngle(body, "knee_R.flex", 22, 28),
      lockAngle(body, "hip_L.flex", 18, 28),
      lockAngle(body, "hip_R.flex", 18, 28),
      lockAngle(body, "clavicle_L.elev", -6, 44),
      lockAngle(body, "clavicle_R.elev", -6, 44),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
    end: [
      lockAngle(body, "knee_L.flex", 4, 28),
      lockAngle(body, "knee_R.flex", 4, 28),
      lockAngle(body, "hip_L.flex", 4, 28),
      lockAngle(body, "hip_R.flex", 4, 28),
      lockAngle(body, "clavicle_L.elev", 26, 44),
      lockAngle(body, "clavicle_R.elev", 26, 44),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Keep the chest up and the lower back flat. Dip the knees, then drive the floor away as you shrug.",
      16,
    ),
    checkNeutralNeck("Look straight ahead so the neck stays near neutral."),
    checkJointRange(
      "knee-drive",
      "Knees dip and drive",
      "Bend the knees slightly, then straighten them quickly to help the shrug.",
      "knee_L.flex",
      10,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight while the shoulders rise toward the ears.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Drive the shoulders up toward the earlobes at the top of the leg drive.",
      "clavicle_L.elev",
      "peak",
      16,
      34,
    ),
    checkJointRange(
      "shrug-rom",
      "Scapulae elevate through the drive",
      "Shrug through the available range as the knees straighten, then lower under control.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
