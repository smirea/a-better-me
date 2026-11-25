import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** High pulley, neutral D-handle, elbow stays tucked as it drives down and back. */
const ACTIVE_REACH = {
  "shoulder.elev": 128,
  "shoulder.plane": 72,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 14,
  "clavicle.prot": 6,
};

const ACTIVE_PULL = {
  "shoulder.elev": 32,
  "shoulder.plane": 18,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 0,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 14,
  "shoulder.plane": 12,
  "elbow.flex": 12,
  "forearm.pron": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 12,
  "hip.flex": 18,
  "knee.flex": 14,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-high-to-low-cable-row",
  catalogId: "1d25c6f170d8800caecdf67ec170c9b9",
  name: "Single Arm High-To-Low Cable Row",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Hip", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.2, heelZ: -0.02, torsoLeanDeg: 12, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.16, 1.88, 0.7],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", ACTIVE_REACH, REST, STANCE),
    end: sidedHints("L", ACTIVE_PULL, REST, STANCE),
  },
  checks: () => [
    checkFlatBack(
      "Your knees, hips, and lower back should remain nearly stationary in a stable position as the center of your breastbone faces the same direction throughout the set.",
    ),
    checkNeutralNeck(
      "Keep your trunk from twisting and your neck quiet while the cable tries to rotate you.",
    ),
    checkJointRange(
      "elbow-row",
      "Elbow bends as the handle comes down and back",
      "Pull the handle back toward your torso by driving your elbow simultaneously downward and backward while progressively bending your elbow.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-high",
      "Arm starts elevated in line with the high cable",
      "Grasp the handle with an extended elbow and your arm elevated to be aligned with the cable.",
      "shoulder_L.elev",
      "top",
      100,
      160,
    ),
    checkJointWithinAt(
      "elbow-tucked",
      "Elbow finishes near the side",
      "Keep your elbow tucked close to your side, level with your torso or slightly behind it.",
      "elbow_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointWithinAt(
      "scapula-back",
      "Shoulder blade pulls back",
      "Your shoulder blade will naturally move backward with your elbow.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
