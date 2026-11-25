import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 8,
  "hip.flex": 88,
  "knee.flex": 76,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 4,
};

const REACH = {
  "shoulder.elev": 56,
  "shoulder.plane": 62,
  "shoulder.twist": -12,
  "elbow.flex": 8,
  "forearm.pron": -72,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": 8,
};

const PULL = {
  "shoulder.elev": 38,
  "shoulder.plane": 26,
  "shoulder.twist": -10,
  "elbow.flex": 106,
  "forearm.pron": -70,
  "wrist.flex": 4,
  "clavicle.elev": 6,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 20,
  "shoulder.plane": 22,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-underhand-grip-low-to-high-machine-low-row",
  catalogId: "39d5c6f170d880c09fc6ea1c1618de9d",
  name: "Single Arm Underhand Grip Low-To-High Machine Low Row",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Ribs", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.5,
    seatZ: -0.02,
    heelZ: 0.36,
    frame: { type: "machine", chestPadZ: 0.3, chestPadY: 0.98, stackZ: -0.95 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    sides: ["L"],
    forceDir: [0, -0.45, 1],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8 },
  hints: {
    start: sidedHints("L", REACH, REST, SEAT),
    end: sidedHints("L", PULL, REST, SEAT),
  },
  checks: () => [
    checkFlatBack("Keep your torso in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep the chest on the pad without rotating the neck."),
    checkJointRange(
      "single-underhand-low-row",
      "Handle travels up and back",
      "Pull the handle back and upward by driving your elbow backward while bending it.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arm-long",
      "Working arm starts outstretched",
      "Reach forward and grasp the horizontal handle with a straight wrist and elbow.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "underhand",
      "Palm faces up",
      "Grasp the horizontal handle with an underhand grip as your palm faces up.",
      "forearm_L.pron",
      "start",
      -90,
      -40,
    ),
    checkJointWithinAt(
      "elbow-tucked",
      "Elbow stays tucked",
      "Keep your elbow tucked reasonably close to your side rather than flaring it out.",
      "shoulder_L.plane",
      "bottom",
      8,
      50,
    ),
    checkJointWithinAt(
      "scapula",
      "Shoulder blade pulls back",
      "Pull your shoulder blade fully back as the elbow finishes level with or slightly behind the torso.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
