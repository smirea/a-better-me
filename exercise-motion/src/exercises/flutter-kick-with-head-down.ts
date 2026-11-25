import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove } from "../solver";

const BASE = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 14,
  "thoracic.flex": 4,
  "neck.flex": 4,
  "hip.abd": 6,
  "ankle.dorsi": -4,
  "shoulder.elev": 14,
  "shoulder.plane": 72,
  "elbow.flex": 6,
  "forearm.pron": 50,
  "wrist.flex": 0,
};

/** Both heels about 15 cm up, knees straight, head down. */
const START = {
  ...BASE,
  "hip.flex": 20,
  "knee.flex": 4,
};

/** Left leg kicks higher while the right stays low. */
const PEAK = sidedHints(
  "L",
  { "hip.flex": 42, "knee.flex": 4 },
  { "hip.flex": 18, "knee.flex": 4 },
  BASE,
);

export const spec = buildExerciseSpec({
  id: "flutter-kick-with-head-down",
  catalogId: "1a45c6f170d880e58427deac0491a551",
  name: "Flutter Kick With Head Down",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Hover", "Kick", "Switch", "Kick"],
  tempo: { lower: 0.7, bottom: 0.05, raise: 0.7, top: 0.05 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "shoulder", "elbow", "neck", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, hip: 3, knee: 8 },
  extraGoals: (body) => [keepAbove(body, "heel_L", 0.06, 36), keepAbove(body, "heel_R", 0.06, 36)],
  hints: { start: START, end: PEAK },
  checks: () => [
    checkJointWithinAt(
      "low-back-pressed",
      "Lower back stays pressed into the floor",
      "Tighten your abdominal muscles to press your lower back down into the ground throughout the set.",
      "lumbar.flex",
      "peak",
      4,
      26,
    ),
    checkJointWithinAt(
      "head-down",
      "Head stays down",
      "For this variation, rest your head on the ground rather than curling it up.",
      "neck.flex",
      "peak",
      -8,
      14,
    ),
    checkJointRange(
      "scissor",
      "Legs scissor up and down",
      "In a scissor-like manner, lower the top leg while lifting the lower leg to the same height.",
      "hip_L.flex",
      12,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep both knees straight while the legs flutter.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
  ],
});
