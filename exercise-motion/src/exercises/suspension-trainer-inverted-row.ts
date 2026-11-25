import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Neutral-grip suspension-trainer row. Rings stand in for the handles:
 * anchored overhead, held at about waist height, body in a reverse plank.
 */
const HANDLE_Y = 0.98;
const HANDLE_Z = 0.02;

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
  "root.z": 0.32,
  "root.pitch": -56,
  "shoulder.elev": 74,
  "shoulder.plane": 76,
  "shoulder.twist": -6,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

const TOP = {
  ...BRIDGE,
  "root.y": 0.78,
  "root.z": 0.36,
  "root.pitch": -40,
  "shoulder.elev": 46,
  "shoulder.plane": 58,
  "shoulder.twist": -4,
  "elbow.flex": 112,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.elev": 8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "suspension-trainer-inverted-row",
  catalogId: "1a15c6f170d8807a903bf497e2880347",
  name: "Suspension Trainer Inverted Row",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Handles", "Lower", "Hang"],
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
  apparatus: {
    kind: "rings",
    anchorY: 2.2,
    spacing: 0.36,
    bodyweightShare: 0,
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 12, thoracic: 10, hip: 10, knee: 8 },
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(0.17, HANDLE_Y, HANDLE_Z), 36),
    pin(body, "grip_R", () => new Vector3(-0.17, HANDLE_Y, HANDLE_Z), 36),
  ],
  hints: { start: BOTTOM, end: TOP },
  checks: () => [
    checkFlatBack(
      "Bridge the hips so you can draw a straight line from the knees through the hips to the shoulders, and keep that reverse-plank shape still.",
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Hold the handles with a neutral grip so the palms face in toward each other.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched",
      "Start leaned back with the arms outstretched up toward the handles and the elbows straight.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay near the sides",
      "Drive the elbows down and back close to the sides until they finish level with the torso or a little behind it.",
      "shoulder_L.plane",
      "peak",
      -55,
      85,
    ),
    checkJointRange(
      "row",
      "Elbows bend through the pull",
      "Pull the chest up toward the handles, then lower under control without dropping.",
      "elbow_L.flex",
      60,
    ),
  ],
});
