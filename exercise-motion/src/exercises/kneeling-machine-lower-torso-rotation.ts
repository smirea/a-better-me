import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { plantToe } from "../solver";

const KNEEL = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.55,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "hip.flex": 8,
  "knee.flex": 100,
  "ankle.dorsi": 25,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
};

const ARMS = {
  "shoulder.elev": 42,
  "shoulder.plane": 58,
  "shoulder.twist": 8,
  "elbow.flex": 88,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "kneeling-machine-lower-torso-rotation",
  catalogId: "1a45c6f170d8800b876ff183a578b045",
  name: "Kneeling Machine Lower Torso Rotation",
  defaultLoadKg: 15,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Rotate", "Far side", "Return", "Lengthened"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: { kind: "kneeling", leanDeg: 2 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 0, -1],
    gripX: 0.16,
  },
  extraGoals: (body) => [
    ...plantToe(body, "L", new Vector3(0.14, 0.08, -0.4), 0, 90),
    ...plantToe(body, "R", new Vector3(-0.14, 0.08, -0.4), 0, 90),
  ],
  stiffness: { lumbar: 6, thoracic: 8, hip: 8, knee: 6 },
  hints: {
    start: { ...KNEEL, ...ARMS, "root.yaw": -22, "lumbar.twist": 8, "thoracic.twist": 14 },
    end: { ...KNEEL, ...ARMS, "root.yaw": 22, "lumbar.twist": -8, "thoracic.twist": -14 },
  },
  checks: () => [
    checkJointRange(
      "pelvis-rotation",
      "Belt buckle rotates under the chest",
      "Turn the imaginary belt buckle away from the side it starts facing while the chest stays on the pad.",
      "lumbar.twist",
      12,
    ),
    checkJointRange(
      "chest-counters",
      "Chest stays nearer to forward than the pelvis",
      "The chest pad holds the chest while the knee pad turns the pelvis underneath it.",
      "thoracic.twist",
      16,
    ),
    checkJointWithinAt(
      "tall-kneel",
      "Knees stay under the hips",
      "Stay in a tall kneel with the thighs vertical and the glutes squeezed.",
      "knee_L.flex",
      "peak",
      70,
      120,
    ),
    checkJointWithinAt(
      "chest-forward",
      "Chest stays on the pad",
      "Keep the chest snug against the pad so the chest keeps facing forward.",
      "thoracic.flex",
      "peak",
      -12,
      16,
    ),
  ],
});
