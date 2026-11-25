import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Chest stays on the pad. The belt buckle stays forward; the chest rotates. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
  "lumbar.twist": 0,
};

const ARMS = {
  "shoulder.elev": 64,
  "shoulder.plane": 48,
  "shoulder.twist": 10,
  "elbow.flex": 72,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "machine-upper-torso-rotation-with-chest-pad",
  catalogId: "1a45c6f170d880d2b252de4d7b72f96c",
  name: "Machine Upper Torso Rotation (With Chest Pad)",
  defaultLoadKg: 15,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Rotate", "Far side", "Return", "Lengthened"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.44,
    seatZ: 0,
    heelZ: 0.4,
    pinBack: false,
    passiveJoints: ["hip", "knee", "ankle"],
    frame: { type: "machine", chestPadZ: 0.3, chestPadY: 0.84, stackZ: -0.72 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [1, 0, 0],
    gripX: 0.16,
  },
  stiffness: { lumbar: 12, thoracic: 4, hip: 8, knee: 8, shoulder: 3, elbow: 4 },
  hints: {
    start: { ...SEAT, ...ARMS, "thoracic.twist": -30 },
    end: { ...SEAT, ...ARMS, "thoracic.twist": 30 },
  },
  checks: () => [
    checkJointRange(
      "chest-rotation",
      "Chest rotates through a long arc",
      "Turn the chest from one side to the other while the chest stays on the pad and the belt buckle keeps facing forward.",
      "thoracic.twist",
      28,
    ),
    checkJointWithinAt(
      "pelvis-still",
      "Belt buckle stays forward",
      "Rotate the chest without turning the pelvis. The imaginary belt buckle keeps facing forward.",
      "lumbar.twist",
      "peak",
      -8,
      8,
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
    checkJointWithinAt(
      "arms-quiet",
      "Elbows stay bent on the handles",
      "Hold the handles for stability. Do not push or pull the machine with the arms.",
      "elbow_L.flex",
      "peak",
      50,
      110,
    ),
  ],
});
