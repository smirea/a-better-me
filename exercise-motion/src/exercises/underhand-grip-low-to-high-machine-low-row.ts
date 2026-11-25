import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Chest-supported low row. Underhand handles travel from low-forward up and back. */
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
  "shoulder.plane": 64,
  "shoulder.twist": -12,
  "elbow.flex": 8,
  "forearm.pron": -72,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": 8,
};

const PULL = {
  "shoulder.elev": 38,
  "shoulder.plane": 28,
  "shoulder.twist": -10,
  "elbow.flex": 104,
  "forearm.pron": -70,
  "wrist.flex": 4,
  "clavicle.elev": 6,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "underhand-grip-low-to-high-machine-low-row",
  catalogId: "39d5c6f170d880028b2cce7b4f8b96b2",
  name: "Underhand Grip Low-To-High Machine Low Row",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
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
    forceDir: [0, -0.45, 1],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8 },
  hints: { start: { ...SEAT, ...REACH }, end: { ...SEAT, ...PULL } },
  checks: () => [
    checkFlatBack("Keep your torso in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep the neck quiet against the chest pad."),
    checkJointRange(
      "underhand-low-row",
      "Handles travel up and back",
      "Pull the handles back and upward by driving your elbows backward while bending them.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Reach forward and grasp the horizontal handles with straight wrists and elbows.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "underhand",
      "Palms face up",
      "Grasp the horizontal handles with an underhand grip as your palms face up.",
      "forearm_L.pron",
      "start",
      -90,
      -40,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay tucked",
      "Keep your elbows tucked reasonably close to your sides rather than flaring them out.",
      "shoulder_L.plane",
      "bottom",
      10,
      50,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Pull your shoulder blades back together as if pinching a pencil between them.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
