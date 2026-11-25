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
  "root.y": 1.32,
  "root.z": 0.0,
  "root.pitch": 0,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 10,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 4,
  ...GRIP,
};

const UP = {
  ...DOWN,
  "hip.flex": 118,
  "knee.flex": 120,
  "lumbar.flex": 22,
  "thoracic.flex": 6,
  "root.pitch": 2,
};

const built = buildExerciseSpec({
  id: "hanging-knee-raise",
  catalogId: "1a45c6f170d880ddb995d193e0cbfeea",
  name: "Hanging Knee Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Hang", "Lift", "Tuck", "Lower"],
  station: { kind: "hanging", barY: 2.32 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] },
    ],
  },
  tempo: { lower: 2.2, bottom: 0.35, raise: 2.2, top: 0.4 },
  stiffness: { hip: 1.1, knee: 1, lumbar: 6, thoracic: 4, elbow: 6 },
  extraGoals: (body) => [
    pin(body, "sternum", () => new Vector3(0, 1.55, 0.0), 30, "z"),
    pin(body, "sacrum", () => new Vector3(0, 1.15, -0.02), 24, "z"),
  ],
  hints: { start: DOWN, end: UP },
  progress: (body, frame) => anchorPoint(body, frame, "kneeFront_L").y,
  checks: () => [
    checkJointRange(
      "knees-to-chest",
      "Both knees march toward the chest",
      "March both knees toward the chest, allowing the knees to bend as they lift higher.",
      "knee_L.flex",
      60,
    ),
    checkJointRange(
      "hips-curl",
      "Hips curl forward",
      "Curl the hips forward so the lower back rounds and the buttocks face forward at the top. Keep the chest facing ahead.",
      "hip_L.flex",
      70,
    ),
    checkJointRange(
      "lower-back-round",
      "Lower back rounds as the knees rise",
      "Curling the hips forward rounds the lower back. Do not lean the torso backward.",
      "lumbar.flex",
      14,
    ),
    checkJointWithinAt(
      "arms-straight",
      "Elbows stay straight on the bar",
      "Maintain a firm overhand grip with straightened elbows throughout the set.",
      "elbow_L.flex",
      "peak",
      -6,
      22,
    ),
    checkJointWithinAt(
      "thighs-start-down",
      "Thighs start directed down",
      "While hanging, the thighs are directed straight down. Lower them back to that line without swinging behind it.",
      "hip_L.flex",
      "start",
      -8,
      28,
    ),
  ],
});

/** Hanging support marks the hips passive. Keep the hips and trunk active. */
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
