import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import type { ExerciseSpec } from "../exercise";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";
import { Vector3 } from "three";

const GRIP = {
  "shoulder.elev": 172,
  "shoulder.plane": 12,
  "shoulder.twist": -20,
  "elbow.flex": 6,
  "forearm.pron": 75,
  "wrist.flex": 8,
  "clavicle.elev": 6,
};

const DOWN = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.34,
  "root.z": 0.0,
  "root.pitch": 0,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 8,
  "hip.abd": 5,
  "knee.flex": 6,
  "ankle.dorsi": 2,
  ...GRIP,
};

const UP = {
  ...DOWN,
  "hip.flex": 88,
  "knee.flex": 24,
  "lumbar.flex": 22,
  "thoracic.flex": 6,
  "root.pitch": 2,
};

const built = buildExerciseSpec({
  id: "hanging-straight-leg-raise",
  catalogId: "1a45c6f170d88065be3acba9f007a364",
  name: "Hanging Straight Leg Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Hang", "Lift", "Top", "Lower"],
  station: { kind: "hanging", barY: 2.32 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] },
    ],
  },
  tempo: { lower: 2.2, bottom: 0.35, raise: 2.2, top: 0.4 },
  stiffness: { hip: 1.3, knee: 3, lumbar: 6, thoracic: 4, elbow: 6 },
  extraGoals: (body) => [
    pin(body, "sternum", () => new Vector3(0, 1.55, 0.0), 30, "z"),
    pin(body, "sacrum", () => new Vector3(0, 1.15, -0.02), 24, "z"),
  ],
  hints: { start: DOWN, end: UP },
  progress: (body, frame) => anchorPoint(body, frame, "kneeFront_L").y,
  checks: () => [
    checkJointRange(
      "legs-rise",
      "Straight legs rise toward the torso",
      "Lift the legs in an arc, upward and forward, then upward and back after they pass parallel to the ground.",
      "hip_L.flex",
      55,
    ),
    checkJointRange(
      "hips-curl",
      "Hips curl so the buttocks face forward",
      "Curl the hips forward. That rounds the lower back and turns the buttocks forward at the top. Keep the chest facing ahead.",
      "lumbar.flex",
      14,
    ),
    checkJointWithinAt(
      "knees-almost-straight",
      "Knees bend only mildly",
      "Keep the knees as close to straight as you can without hamstring flexibility cutting the range, so the feet stay in front of the knees.",
      "knee_L.flex",
      "peak",
      -4,
      32,
    ),
    checkJointWithinAt(
      "arms-straight",
      "Elbows stay straight on the bar",
      "Hang from a firm overhand grip with the elbows straightened for the whole set.",
      "elbow_L.flex",
      "start",
      -6,
      22,
    ),
    checkJointWithinAt(
      "legs-start-down",
      "A straight line from the torso through the legs",
      "Start hanging so you can draw a straight line vertically down from the torso through the legs, and return there without swinging behind it.",
      "hip_L.flex",
      "start",
      -10,
      24,
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
        passive: ["clavicle", "shoulder", "elbow", "wrist"],
      },
    };
  },
};
