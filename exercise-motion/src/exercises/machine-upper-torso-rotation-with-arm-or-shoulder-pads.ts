import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Arms rest out on the pads. The chest turns; the pelvis stays square. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "lumbar.bend": 0,
  "lumbar.twist": 0,
  "thoracic.bend": 0,
};

const ARMS = {
  "shoulder.elev": 68,
  "shoulder.plane": 18,
  "shoulder.twist": 8,
  "elbow.flex": 78,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": -6,
};

export const spec = buildExerciseSpec({
  id: "machine-upper-torso-rotation-with-arm-or-shoulder-pads",
  catalogId: "28c5c6f170d8805cb02ae70c20b9350f",
  name: "Machine Upper Torso Rotation (With Arm Or Shoulder Pads)",
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
    pinBack: false,
    passiveJoints: ["hip", "knee", "ankle"],
    frame: { type: "machine", stackZ: -0.72 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [1, 0, 0],
    gripX: 0.28,
  },
  stiffness: { lumbar: 12, thoracic: 4, hip: 8, knee: 8, elbow: 4 },
  hints: {
    start: { ...SEAT, ...ARMS, "thoracic.twist": -30 },
    end: { ...SEAT, ...ARMS, "thoracic.twist": 30 },
  },
  checks: () => [
    checkJointRange(
      "chest-rotation",
      "Chest rotates through a long arc",
      "Turn the chest from one side to the other while the arms or shoulders stay on the pads.",
      "thoracic.twist",
      40,
    ),
    checkJointWithinAt(
      "pelvis-still",
      "Belt buckle stays forward",
      "Rotate the chest without turning the imaginary belt buckle.",
      "lumbar.twist",
      "peak",
      -8,
      8,
    ),
    checkJointWithinAt(
      "arms-out",
      "Arms stay out on the pads",
      "Spread the arms so the inner arms stay against the pads, or rest the shoulder pads on the shoulders.",
      "shoulder_L.plane",
      "peak",
      0,
      40,
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
