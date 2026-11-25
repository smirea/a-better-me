import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const SEAT = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -6,
  "hip.flex": 84,
  "knee.flex": 90,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": -4,
};

const UP = {
  "shoulder.elev": 150,
  "shoulder.plane": 60,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "wrist.flex": 2,
  "clavicle.elev": 14,
  "clavicle.prot": 6,
};

const DOWN = {
  "shoulder.elev": 36,
  "shoulder.plane": 34,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 8,
  "wrist.flex": 4,
  "clavicle.elev": -10,
  "clavicle.prot": -14,
};

const REST = {
  "shoulder.elev": 18,
  "shoulder.plane": 20,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-plate-loaded-machine-high-row",
  catalogId: "3895c6f170d88059bc07cb2265b3866c",
  name: "Single Arm Plate-Loaded Machine High Row",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Ribs", "Return", "Reach"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.46,
    seatZ: -0.02,
    stanceX: 0.16,
    heelZ: 0.34,
    leanDeg: -6,
    frame: { type: "lat-pulldown", thighPadY: 0.64, pulleyZ: 0.28, columnZ: 1.15 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    sides: ["L"],
    forceDir: [0, 1, 0.25],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.4, shoulder: 1.2, clavicle: 0.8 },
  hints: {
    start: sidedHints("L", UP, REST, SEAT),
    end: sidedHints("L", DOWN, REST, SEAT),
  },
  checks: () => [
    checkFlatBack(
      "Keep your torso in the same position throughout your set rather than progressively leaning backward.",
    ),
    checkNeutralNeck("Keep the neck quiet while the working arm travels overhead."),
    checkJointRange(
      "single-high-row",
      "Elbow drives down and back",
      "Drive your elbow down and back toward your side while progressively bending it to pull the handle toward you.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-overhead",
      "Working arm starts overhead",
      "Allow your elbow to straighten and your arm to raise overhead in line with the machine’s resistance.",
      "shoulder_L.elev",
      "top",
      120,
      175,
    ),
    checkJointWithinAt(
      "elbow-behind",
      "Elbow finishes beside the torso",
      "Pull through your full range of motion so your elbow finishes slightly behind your torso.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkJointWithinAt(
      "scapula-down",
      "Shoulder blade pulls down and back",
      "Simultaneously pull your shoulder blade down and back.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
