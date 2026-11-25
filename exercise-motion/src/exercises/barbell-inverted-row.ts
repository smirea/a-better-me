import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { powerRack } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Bar sits in the J-cups about hip height. The body moves; the bar stays put. */
const BAR_Y = 1.08;
const BAR_Z = 0.02;

const BRIDGE = {
  ...POSTURE_HINTS.supineFloor,
  "hip.flex": 12,
  "hip.abd": 6,
  "knee.flex": 28,
  "ankle.dorsi": 22,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 6,
};

const BOTTOM = {
  ...BRIDGE,
  "root.y": 0.72,
  "root.z": 0.28,
  "root.pitch": -58,
  "shoulder.elev": 96,
  "shoulder.plane": 74,
  "shoulder.twist": 12,
  "elbow.flex": 12,
  "forearm.pron": 76,
  "wrist.flex": 4,
  "clavicle.elev": 6,
  "clavicle.prot": 4,
};

const TOP = {
  ...BRIDGE,
  "root.y": 0.78,
  "root.z": 0.32,
  "root.pitch": -42,
  "shoulder.elev": 70,
  "shoulder.plane": 40,
  "shoulder.twist": 14,
  "elbow.flex": 105,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "barbell-inverted-row",
  catalogId: "1a15c6f170d8807881c7facb5d5cdb97",
  name: "Barbell Inverted Row",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    pinSacrum: false,
    feetOnFloor: true,
    heelZ: 0.42,
    stanceX: 0.14,
    passiveJoints: ["ankle"],
  },
  extraEquipment: powerRack({ hookY: 1.12, safetyY: 0.45, zCenter: 0.35, hooksOnFront: true }).parts,
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.28,
    path: { startY: BAR_Y, startZ: BAR_Z, endY: BAR_Y, endZ: BAR_Z },
  },
  stiffness: { elbow: 2.4, shoulder: 1.1, lumbar: 12, thoracic: 10, hip: 10, knee: 8 },
  hints: { start: BOTTOM, end: TOP },
  checks: () => [
    checkFlatBack(
      "Bridge the hips so you can draw a straight line from the knees through the hips to the shoulders, and keep that reverse-plank shape still.",
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip just outside the shoulders",
      "Grasp the bar with an overhand grip slightly outside shoulder width so the palms face down.",
      "forearm_L.pron",
      "start",
      50,
      90,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Start with the arms outstretched up toward the bar and the elbows straight.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "chest-to-bar",
      "Elbows bend as the chest rises",
      "Pull the chest toward the bar by driving the elbows down and back until they are bent.",
      "elbow_L.flex",
      "peak",
      85,
      135,
    ),
    checkJointRange(
      "row",
      "Elbows bend through the pull",
      "Pull through the full range aiming for the chest to reach the bar, then lower under control with the knees, hips, and shoulders still aligned.",
      "elbow_L.flex",
      60,
    ),
  ],
});
