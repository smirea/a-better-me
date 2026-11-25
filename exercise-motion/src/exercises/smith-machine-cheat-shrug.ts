import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Overhand Smith shrug that borrows a short hip-and-knee drive. */
const GRIP = {
  "shoulder.elev": 14,
  "shoulder.plane": 70,
  "shoulder.twist": 14,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-cheat-shrug",
  catalogId: "2a15c6f170d880f8a62af0d9087dee31",
  name: "Smith Machine Cheat Shrug",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Hinge", "Drive", "Lower", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 0.55, top: 0.2 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 6, smith: { stopY: 0.58 } },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.72, startZ: 0.18, endY: 0.86, endZ: 0.16 },
  },
  stiffness: { elbow: 6, shoulder: 2, clavicle: 0.45, knee: 0.65, hip: 0.65, lumbar: 6 },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "root.y": 0.91,
      "root.z": -0.01,
      "root.pitch": 8,
      "hip.flex": 18,
      "knee.flex": 16,
      "ankle.dorsi": 4,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "clavicle.elev": -6,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...GRIP,
      "root.pitch": 0,
      "hip.flex": 4,
      "knee.flex": 4,
      "clavicle.elev": 26,
    },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "hip_L.flex", 18, 40),
      lockAngle(body, "hip_R.flex", 18, 40),
      lockAngle(body, "knee_L.flex", 16, 32),
      lockAngle(body, "knee_R.flex", 16, 32),
      lockAngle(body, "clavicle_L.elev", -6, 44),
      lockAngle(body, "clavicle_R.elev", -6, 44),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
    end: [
      lockAngle(body, "hip_L.flex", 4, 32),
      lockAngle(body, "hip_R.flex", 4, 32),
      lockAngle(body, "knee_L.flex", 4, 26),
      lockAngle(body, "knee_R.flex", 4, 26),
      lockAngle(body, "clavicle_L.elev", 26, 44),
      lockAngle(body, "clavicle_R.elev", 26, 44),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Keep the lower back flat. Sit the hips back, then thrust them forward as you shrug.",
      16,
    ),
    checkNeutralNeck("Look straight ahead and keep the neck near neutral."),
    checkJointRange(
      "hip-drive",
      "Hips help the shrug",
      "Hinge slightly, then thrust the hips forward and straighten the knees with the shrug.",
      "hip_L.flex",
      12,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with a near shoulder-width overhand grip so the palms face backward.",
      "forearm_L.pron",
      "start",
      50,
      86,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight while the bar rises on the rails.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointRange(
      "shrug-rom",
      "Bar rises with the drive",
      "Shrug through the available range as the hips lock out, then lower under control.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
