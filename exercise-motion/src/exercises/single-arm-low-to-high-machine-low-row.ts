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
  "shoulder.elev": 58,
  "shoulder.plane": 70,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": 10,
};

const PULL = {
  "shoulder.elev": 42,
  "shoulder.plane": 28,
  "shoulder.twist": 2,
  "elbow.flex": 102,
  "forearm.pron": 6,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 20,
  "shoulder.plane": 24,
  "elbow.flex": 18,
  "forearm.pron": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-low-to-high-machine-low-row",
  catalogId: "2c35c6f170d880eeb903fb2fdbb249d8",
  name: "Single Arm Low-To-High Machine Low Row",
  defaultLoadKg: 16,
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
    frame: { type: "machine", chestPadZ: 0.34, chestPadY: 0.9, stackZ: -0.95 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    sides: ["L"],
    forceDir: [0, -0.45, 1],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    "machine.chestPad": { neck: 0.08, girdle: 0.08, head: 0.06, chest: 0.04 },
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
      "single-low-row",
      "Handle travels up and back",
      "Pull the handle back and upward by driving your elbow backward while bending it.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arm-long",
      "Working arm starts outstretched",
      "Reach forward and grasp the handle with a straight wrist and elbow.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "neutral",
      "Palm angled inward",
      "Grasp the handle with your palm angled inward.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "elbow-tucked",
      "Elbow stays tucked",
      "Keep your elbow tucked reasonably close to your side rather than flaring it out.",
      "shoulder_L.plane",
      "bottom",
      10,
      52,
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
