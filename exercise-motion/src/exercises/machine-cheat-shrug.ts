import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Y, box, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Standing plate-loaded cheat shrug: a short knee dip, then a shrug with the drive. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 24,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": 0,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "machine-cheat-shrug",
  catalogId: "2a35c6f170d8800c9b3de01d90acbc44",
  name: "Machine Cheat Shrug",
  defaultLoadKg: 36,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Dip", "Drive", "Lower", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 0.55, top: 0.2 },
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
  stiffness: { elbow: 6, shoulder: 2.2, clavicle: 0.45, knee: 0.7, hip: 0.7, lumbar: 6 },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.9,
      "root.pitch": 6,
      "hip.flex": 16,
      "knee.flex": 22,
      "ankle.dorsi": 6,
      "lumbar.flex": 2,
      "clavicle.elev": -6,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "hip.flex": 4,
      "knee.flex": 4,
      "clavicle.elev": 26,
    },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "knee_L.flex", 22, 28),
      lockAngle(body, "knee_R.flex", 22, 28),
      lockAngle(body, "hip_L.flex", 16, 26),
      lockAngle(body, "hip_R.flex", 16, 26),
      lockAngle(body, "clavicle_L.elev", -6, 44),
      lockAngle(body, "clavicle_R.elev", -6, 44),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
    end: [
      lockAngle(body, "knee_L.flex", 4, 28),
      lockAngle(body, "knee_R.flex", 4, 28),
      lockAngle(body, "hip_L.flex", 4, 26),
      lockAngle(body, "hip_R.flex", 4, 26),
      lockAngle(body, "clavicle_L.elev", 26, 44),
      lockAngle(body, "clavicle_R.elev", 26, 44),
      lockAngle(body, "elbow_L.flex", 8, 28),
      lockAngle(body, "elbow_R.flex", 8, 28),
    ],
  }),
  checks: () => [
    checkFlatBack("Keep the chest up. Dip, then drive through the legs without rounding the back.", 16),
    checkNeutralNeck("Look straight ahead so the neck stays near neutral."),
    checkJointRange(
      "knee-drive",
      "Knees dip and drive",
      "Bend the knees slightly, then straighten them as the shoulders shrug.",
      "knee_L.flex",
      10,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight on the handles through the drive and the lower.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointRange(
      "shrug-rom",
      "Handles rise with the leg drive",
      "Shrug through the available range as the knees straighten, then lower under control.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
