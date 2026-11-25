import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove } from "../solver";

const BASE = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.16,
  "root.pitch": -78,
  "lumbar.flex": 14,
  "thoracic.flex": 20,
  "neck.flex": 20,
  "hip.abd": 6,
  "ankle.dorsi": -4,
  "shoulder.elev": 20,
  "shoulder.plane": 70,
  "elbow.flex": 8,
  "forearm.pron": 40,
  "wrist.flex": 0,
};

const START = {
  ...BASE,
  "hip.flex": 20,
  "knee.flex": 4,
};

const PEAK = sidedHints(
  "L",
  { "hip.flex": 42, "knee.flex": 4 },
  { "hip.flex": 18, "knee.flex": 4 },
  BASE,
);

export const spec = buildExerciseSpec({
  id: "flutter-kick-with-head-up",
  catalogId: "2345c6f170d880439d36f78be23bd003",
  name: "Flutter Kick With Head Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Curl", "Kick", "Switch", "Kick"],
  tempo: { lower: 0.7, bottom: 0.05, raise: 0.7, top: 0.05 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "elbow", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, thoracic: 12, hip: 3, knee: 8 },
  extraGoals: (body) => [
    keepAbove(body, "heel_L", 0.06, 36),
    keepAbove(body, "heel_R", 0.06, 36),
    keepAbove(body, "occiput", 0.06, 28),
  ],
  hints: { start: START, end: PEAK },
  checks: () => [
    checkJointWithinAt(
      "head-up",
      "Head and shoulder blades stay up",
      "Tuck your chin and mildly curl your upper back so your shoulder blades stay slightly off the ground.",
      "thoracic.flex",
      "peak",
      10,
      34,
    ),
    checkJointWithinAt(
      "low-back-pressed",
      "Lower back stays pressed into the floor",
      "Keep your lower back pressed into the ground with your abdominal muscles tensed as you avoid arching.",
      "lumbar.flex",
      "peak",
      4,
      26,
    ),
    checkJointRange(
      "scissor",
      "Legs scissor up and down",
      "Lower the top leg toward about 15 centimeters off the ground while lifting the other leg to the higher position.",
      "hip_L.flex",
      12,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep both knees straightened while you flutter.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
  ],
});
