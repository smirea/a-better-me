import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plate-loaded D.Y. row: underhand, chest-supported, handle travels high-to-low into the side. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 10,
  "hip.flex": 86,
  "knee.flex": 74,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 0,
};

const REACH = {
  "shoulder.elev": 96,
  "shoulder.plane": 68,
  "shoulder.twist": -12,
  "elbow.flex": 8,
  "forearm.pron": -68,
  "wrist.flex": 2,
  "clavicle.elev": 10,
  "clavicle.prot": 8,
};

const PULL = {
  "shoulder.elev": 34,
  "shoulder.plane": 26,
  "shoulder.twist": -8,
  "elbow.flex": 108,
  "forearm.pron": -66,
  "wrist.flex": 4,
  "clavicle.elev": -2,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 22,
  "shoulder.plane": 22,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-machine-d-y-row",
  catalogId: "3895c6f170d8804f9e7edf37ac311801",
  name: "Single Arm Machine D.Y. Row",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Side", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: -0.02,
    heelZ: 0.36,
    frame: { type: "machine", chestPadZ: 0.42, chestPadY: 0.9, stackZ: -0.95 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    sides: ["L"],
    forceDir: [0, 0.35, 1],
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
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep the neck quiet against the chest pad."),
    checkJointRange(
      "dy-row",
      "Handle travels high to low",
      "Pull the handle back toward your side by driving your elbow backward while bending it.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-long",
      "Working arm starts straight",
      "Reach forward and grasp the handle with an underhand grip, a straight wrist, and a straight elbow.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "underhand",
      "Palm faces up",
      "Grasp the handle with an underhand grip as your palm faces up.",
      "forearm_L.pron",
      "start",
      -90,
      -35,
    ),
    checkJointWithinAt(
      "elbow-tucked",
      "Elbow stays tucked",
      "Keep the elbow tucked fairly close to your side rather than flaring it out.",
      "shoulder_L.plane",
      "bottom",
      8,
      50,
    ),
    checkJointWithinAt(
      "scapula",
      "Shoulder blade pulls back",
      "Pull your shoulder blade fully back so the elbow finishes slightly behind your torso.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
