import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/**
 * Body suspended at an angle under gymnastics rings set near hip height.
 * Keep a straight plank and pull the chest to the rings.
 */
const RING_Y = 1.0;
const RING_Z = 0.02;

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
  "shoulder.elev": 76,
  "shoulder.plane": 70,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": 4,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const TOP = {
  ...BRIDGE,
  "root.y": 0.78,
  "root.z": 0.36,
  "root.pitch": -40,
  "shoulder.elev": 48,
  "shoulder.plane": 42,
  "shoulder.twist": 6,
  "elbow.flex": 108,
  "forearm.pron": 24,
  "wrist.flex": 4,
  "clavicle.elev": 8,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "inverted-ring-row",
  catalogId: "2ea5c6f170d880dca6bed770e58a21d6",
  name: "Inverted Ring Row",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Rings", "Lower", "Hang"],
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
    anchorY: 2.15,
    spacing: 0.5,
    bodyweightShare: 0,
  },
  stiffness: { elbow: 2.2, shoulder: 1.1, lumbar: 12, thoracic: 10, hip: 10, knee: 8 },
  extraGoals: (body) => [
    pin(body, "grip_L", () => new Vector3(0.22, RING_Y, RING_Z), 36),
    pin(body, "grip_R", () => new Vector3(-0.22, RING_Y, RING_Z), 36),
  ],
  hints: { start: BOTTOM, end: TOP },
  checks: () => [
    checkFlatBack(
      "Keep a straight line from the heels through the hips to the shoulders, the same brace you would hold in a plank, while the rings stay still.",
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start long under the rings",
      "Start suspended at an angle with the arms reaching up to the rings and the elbows straight.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "chest-to-rings",
      "Elbows bend as the chest rises",
      "Pull the chest up to the rings by bending the elbows and retracting the shoulder blades.",
      "elbow_L.flex",
      "peak",
      85,
      135,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pull together",
      "Finish the pull with the shoulder blades together and the chest at the rings.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
    checkJointRange(
      "row",
      "Elbows bend through the pull",
      "Pull the chest to the rings, then lower under control until the arms are straight again.",
      "elbow_L.flex",
      60,
    ),
  ],
});
