import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { powerRack } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

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
  "shoulder.elev": 98,
  "shoulder.plane": 55,
  "shoulder.twist": 16,
  "elbow.flex": 12,
  "forearm.pron": 76,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": 6,
};

const TOP = {
  ...BRIDGE,
  "root.y": 0.78,
  "root.z": 0.32,
  "root.pitch": -42,
  "shoulder.elev": 74,
  "shoulder.plane": 24,
  "shoulder.twist": 18,
  "elbow.flex": 100,
  "forearm.pron": 74,
  "wrist.flex": 4,
  "clavicle.elev": 10,
  "clavicle.prot": -12,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-barbell-inverted-row",
  catalogId: "1d45c6f170d8809ab398df8048e00468",
  name: "Wide Grip Barbell Inverted Row",
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
    gripX: 0.46,
    path: { startY: BAR_Y, startZ: BAR_Z, endY: BAR_Y, endZ: BAR_Z },
  },
  stiffness: { elbow: 2.4, shoulder: 1.1, lumbar: 12, thoracic: 10, hip: 10, knee: 8 },
  hints: { start: BOTTOM, end: TOP },
  checks: () => [
    checkFlatBack(
      "Bridge the hips so you can draw a straight line from the knees through the hips to the shoulders, and keep that reverse-plank shape still.",
    ),
    checkJointWithinAt(
      "wide-overhand",
      "Wide overhand grip",
      "Grasp the bar clearly outside shoulder width with an overhand grip so the palms face down.",
      "forearm_L.pron",
      "start",
      50,
      90,
    ),
    checkJointWithinAt(
      "elbows-flare",
      "Elbows flare out",
      "Let the elbows flare away from the sides as you pull, which is the comfortable path for a wide overhand grip.",
      "shoulder_L.plane",
      "peak",
      -25,
      45,
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
    checkJointRange(
      "row",
      "Elbows bend through the pull",
      "Pull the chest toward the bar while the shoulder blades come together, then lower under control.",
      "elbow_L.flex",
      55,
    ),
  ],
});
