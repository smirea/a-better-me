import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import type { ExerciseSpec } from "../exercise";
import { IDENTITY, type Part } from "../equipment";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";
import { Vector3 } from "three";

const BACK_PAD: Part = {
  id: "chair.back",
  shape: "box",
  size: [0.26, 0.42, 0.06],
  pos: [0, 1.28, -0.16],
  quat: IDENTITY,
  material: "pad",
  collide: false,
};

const HANG = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.18,
  "root.z": 0.06,
  "root.pitch": 0,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "hip.abd": 6,
  "ankle.dorsi": 2,
  "clavicle.elev": 2,
  "shoulder.elev": 22,
  "shoulder.plane": 78,
  "shoulder.twist": 18,
  "elbow.flex": 95,
  "forearm.pron": 8,
  "wrist.flex": 6,
};

const DOWN = {
  ...HANG,
  "hip.flex": 8,
  "knee.flex": 6,
};

const UP = {
  ...HANG,
  "hip.flex": 92,
  "knee.flex": 22,
  "lumbar.flex": 22,
  "thoracic.flex": 4,
  "root.pitch": 2,
};

const built = buildExerciseSpec({
  id: "captains-chair-straight-leg-raise",
  catalogId: "1a45c6f170d88024a964c29f6c9b4853",
  name: "Captain's Chair Straight Leg Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Hang", "Lift", "Top", "Lower"],
  station: { kind: "dip", barY: 1.38, spacing: 0.58 },
  extraEquipment: [BACK_PAD],
  extraContacts: {
    "dip.bar_L": { upperarm_L: 0.045, forearm_L: 0.02 },
    "dip.bar_R": { upperarm_R: 0.045, forearm_R: 0.02 },
  },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "press_L", bodyweightShare: 0.42, grip: "press", direction: [0, 1, 0] },
      { anchor: "press_R", bodyweightShare: 0.42, grip: "press", direction: [0, 1, 0] },
    ],
  },
  extraGoals: (body) => [
    pin(body, "sternum", () => new Vector3(0, 1.5, 0.04), 26, "z"),
    pin(body, "sacrum", () => new Vector3(0, 1.12, 0.02), 22, "z"),
  ],
  stiffness: { hip: 1.4, knee: 3, lumbar: 10, shoulder: 4, elbow: 6 },
  hints: { start: DOWN, end: UP },
  progress: (body, frame) => anchorPoint(body, frame, "kneeFront_L").y,
  checks: () => [
    checkJointRange(
      "legs-rise",
      "Straight legs rise in an arc",
      "Lift the legs up and toward the torso. They arc upward and forward, then upward and back once they pass parallel to the ground.",
      "hip_L.flex",
      60,
    ),
    checkJointRange(
      "hips-curl",
      "Hips curl so the buttocks face forward",
      "Curl the hips forward. That rounds the lower back and turns the buttocks forward at the top of the lift.",
      "lumbar.flex",
      14,
    ),
    checkJointWithinAt(
      "knees-almost-straight",
      "Knees bend only mildly",
      "Keep the knees as close to straight as hamstring flexibility allows, so the feet stay clearly in front of the knees.",
      "knee_L.flex",
      "peak",
      -4,
      32,
    ),
    checkJointWithinAt(
      "legs-start-down",
      "Thighs start directed straight down",
      "Hang so you can draw a straight line vertically down from the torso through the legs, then return to that line without swinging behind it.",
      "hip_L.flex",
      "start",
      -10,
      24,
    ),
    checkJointWithinAt(
      "torso-still",
      "Elbows stay braced while the legs move",
      "Bear bodyweight through the elbows into the arm pads and keep the upper body stationary.",
      "elbow_L.flex",
      "peak",
      70,
      120,
    ),
  ],
});

export const spec: ExerciseSpec = {
  ...built,
  build(body) {
    const frame = built.build(body);
    return {
      ...frame,
      support: {
        ...frame.support,
        passive: ["clavicle", "shoulder", "elbow", "forearm", "wrist"],
      },
    };
  },
};
