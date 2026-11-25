import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Chest on the pad. Neutral handles travel from low-forward up and back to the ribs. */
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
  "shoulder.plane": 72,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": 10,
};

const PULL = {
  "shoulder.elev": 42,
  "shoulder.plane": 30,
  "shoulder.twist": 2,
  "elbow.flex": 100,
  "forearm.pron": 6,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "low-to-high-machine-low-row",
  catalogId: "2ad5c6f170d88073b499feb22416b456",
  name: "Low-To-High Machine Low Row",
  defaultLoadKg: 18,
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
    frame: { type: "machine", chestPadZ: 0.34, chestPadY: 0.9, stackZ: -0.95 },
    feetMode: "floor",
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, -0.45, 1],
  },
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
    handle_R: { upperarm_R: 0.1, chest: 0.12, thigh_R: 0.1, shank_R: 0.1, forearm_R: 0.08, pelvis: 0.08 },
    "machine.chestPad": { neck: 0.08, girdle: 0.08, head: 0.06, chest: 0.04 },
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 8 },
  hints: { start: { ...SEAT, ...REACH }, end: { ...SEAT, ...PULL } },
  checks: () => [
    checkFlatBack("Keep your torso in contact with the chest pad throughout the set."),
    checkNeutralNeck("Keep the neck quiet against the chest pad."),
    checkJointRange(
      "low-to-high",
      "Handles travel up and back",
      "Instead of moving straight backward, pull the handles at an upward angle while driving your elbows backward.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Reach forward and grasp the handles with straight wrists and elbows.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "neutral",
      "Palms angled inward",
      "Grasp the handles with your palms angled in toward each other.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay tucked",
      "Keep your elbows tucked reasonably close to your sides rather than flaring them out.",
      "shoulder_L.plane",
      "bottom",
      12,
      52,
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
