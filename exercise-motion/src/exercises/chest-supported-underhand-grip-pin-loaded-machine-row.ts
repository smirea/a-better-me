import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Chest-supported pin-loaded row. Underhand or semi-underhand, elbows tucked. */
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
  "shoulder.elev": 72,
  "shoulder.plane": 64,
  "shoulder.twist": -12,
  "elbow.flex": 8,
  "forearm.pron": -70,
  "wrist.flex": 4,
  "clavicle.elev": 4,
  "clavicle.prot": 8,
};

const PULL = {
  "shoulder.elev": 36,
  "shoulder.plane": 28,
  "shoulder.twist": -10,
  "elbow.flex": 110,
  "forearm.pron": -68,
  "wrist.flex": 4,
  "clavicle.elev": 4,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "chest-supported-underhand-grip-pin-loaded-machine-row",
  catalogId: "39a5c6f170d88068a174c97856456c71",
  name: "Chest-Supported Underhand Grip Pin-Loaded Machine Row",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Ribs", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.52,
    seatZ: -0.02,
    heelZ: 0.36,
    frame: { type: "machine", chestPadZ: 0.3, chestPadY: 0.98, stackZ: -0.85 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 0, 1],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8 },
  hints: { start: { ...SEAT, ...REACH }, end: { ...SEAT, ...PULL } },
  checks: () => [
    checkFlatBack("Keep your chest in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep the neck quiet against the torso pad."),
    checkJointRange(
      "underhand-row",
      "Elbows drive back beside the torso",
      "Pull the handles back toward the sides of your torso by driving your elbows backward while bending them.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Reach fully forward with straight elbows to grasp the handles.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "underhand",
      "Palms angled upward",
      "Grasp the handles firmly with your palms angled upward.",
      "forearm_L.pron",
      "start",
      -90,
      -35,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay tucked",
      "Keep your elbows tucked close to your sides with this grip rather than flaring them away.",
      "shoulder_L.plane",
      "bottom",
      10,
      50,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Pull your shoulder blades together as if pinching a pencil between them.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
