import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Chest stays on the pad. The seat (pelvis) rotates under a chest that faces forward,
 * so root yaw and a counter-twist trade places.
 */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
};

const ARMS = {
  "shoulder.elev": 40,
  "shoulder.plane": 58,
  "shoulder.twist": 8,
  "elbow.flex": 90,
  "forearm.pron": 18,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "seated-machine-lower-torso-rotation",
  catalogId: "28b5c6f170d88037bb6bde21e8f1712e",
  name: "Seated Machine Lower Torso Rotation",
  defaultLoadKg: 15,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Rotate", "Far side", "Return", "Lengthened"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: 0,
    heelZ: 0.46,
    feetMode: "hanging",
    pinBack: false,
    passiveJoints: ["hip", "knee", "ankle", "shoulder", "elbow"],
    frame: { type: "machine", stackZ: -0.72 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 0, -1],
    gripX: 0.16,
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.16, 0.22, 0.58), 36),
    pin(body, "heel_R", () => new Vector3(-0.16, 0.22, 0.58), 36),
    pin(body, "ballIn_L", () => new Vector3(0.16, 0.2, 0.72), 28),
    pin(body, "ballIn_R", () => new Vector3(-0.16, 0.2, 0.72), 28),
  ],
  stiffness: { lumbar: 6, thoracic: 8, hip: 8, knee: 8 },
  hints: {
    start: { ...SEAT, ...ARMS, "ankle.dorsi": 0, "root.yaw": -28, "lumbar.twist": 8, "thoracic.twist": 18 },
    end: { ...SEAT, ...ARMS, "ankle.dorsi": 0, "root.yaw": 28, "lumbar.twist": -8, "thoracic.twist": -18 },
  },
  checks: () => [
    checkJointRange(
      "pelvis-rotation",
      "Belt buckle rotates under the chest",
      "Turn the imaginary belt buckle from one side to the other while the chest stays on the pad.",
      "lumbar.twist",
      10,
    ),
    checkJointRange(
      "chest-counters",
      "Chest stays nearer to forward than the pelvis",
      "The chest pad holds the chest while the seat turns the pelvis underneath it.",
      "thoracic.twist",
      20,
    ),
    checkJointWithinAt(
      "chest-forward",
      "Chest stays facing the pad",
      "Keep the chest snug on the pad so the chest does not turn with the pelvis.",
      "thoracic.twist",
      "peak",
      -28,
      4,
    ),
    checkJointWithinAt(
      "upright",
      "Torso stays upright",
      "Sit upright with a neutral lower back rather than rounding or arching.",
      "lumbar.flex",
      "peak",
      -12,
      16,
    ),
  ],
});
