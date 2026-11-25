import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ACTIVE_REACH = {
  "shoulder.elev": 86,
  "shoulder.plane": 80,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": 8,
};

const ACTIVE_PULL = {
  "shoulder.elev": 30,
  "shoulder.plane": 16,
  "shoulder.twist": 2,
  "elbow.flex": 110,
  "forearm.pron": 0,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 14,
  "shoulder.plane": 14,
  "elbow.flex": 14,
  "forearm.pron": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 10,
  "hip.flex": 16,
  "knee.flex": 14,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "standing-single-arm-cable-row",
  catalogId: "1a15c6f170d880f9a7c3de4cae380ab5",
  name: "Standing Single Arm Cable Row",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Hip", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    toeOutDeg: 8,
    torsoLeanDeg: 8,
    balanceZ: false,
    split: { frontZ: 0.16, rearZ: -0.18, rearMode: "flat" },
  },
  stiffness: { elbow: 3, shoulder: 1.2 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.16, 1.28, 0.62],
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
      "Movement should occur at your shoulder, shoulder blade, and elbow, but your knees, hips, and lower back should remain nearly stationary.",
    ),
    checkNeutralNeck(
      "Keep the center of your breastbone facing forward rather than letting your trunk rotate.",
    ),
    checkJointRange(
      "elbow-row",
      "Elbow bends through the standing row",
      "Drive your elbow back toward your side while simultaneously bending it.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-level",
      "Arm starts at pulley height",
      "Grasp the handle with a straight elbow and your arm elevated to the height of the pulley.",
      "shoulder_L.elev",
      "top",
      65,
      115,
    ),
    checkJointWithinAt(
      "elbow-tucked",
      "Elbow finishes tucked by the side",
      "Keep your elbow tucked near your side, level with your torso or slightly behind it.",
      "elbow_L.flex",
      "bottom",
      90,
      135,
    ),
    checkJointWithinAt(
      "scapula-back",
      "Shoulder blade pulls back",
      "Pull your shoulder blade backward as you row, then let it travel forward on the return.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
