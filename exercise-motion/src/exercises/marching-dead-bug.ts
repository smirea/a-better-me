import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TABLETOP = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.13,
  "root.pitch": -88,
  "lumbar.flex": 12,
  "thoracic.flex": 4,
  "neck.flex": 6,
  "hip.abd": 8,
  "ankle.dorsi": 0,
  "shoulder.elev": 36,
  "shoulder.plane": 70,
  "shoulder.twist": 16,
  "elbow.flex": 96,
  "forearm.pron": 10,
  "wrist.flex": 4,
};

/** Both knees stacked over the hips, one hand resting on the abdomen. */
const START = {
  ...TABLETOP,
  "hip.flex": 92,
  "knee.flex": 92,
};

/** Left leg reaches long and taps the heel down. The right knee stays stacked. */
const PEAK = sidedHints(
  "L",
  { "hip.flex": 16, "knee.flex": 8 },
  { "hip.flex": 92, "knee.flex": 92 },
  TABLETOP,
);

export const spec = buildExerciseSpec({
  id: "marching-dead-bug",
  catalogId: "2785c6f170d880bf96c9d244273c7e69",
  name: "Marching Dead Bug",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Stack", "Reach", "Return", "Reach"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "shoulder", "elbow", "neck", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, hip: 4, knee: 3 },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Press your lower back lightly into the floor and keep it there. All the movement should occur from your hip and knee.",
      8,
    ),
    checkJointRange(
      "leg-reaches",
      "One leg reaches long toward the floor",
      "Slowly lower one leg toward the ground while straightening its knee, and gently tap the ground with your heel.",
      "hip_L.flex",
      40,
    ),
    checkJointRange(
      "knee-straightens",
      "The moving knee straightens",
      "With sufficient core control, finish with the moving leg parallel to the ground and the knee straightened.",
      "knee_L.flex",
      40,
    ),
    checkJointWithinAt(
      "other-knee-stacked",
      "The stationary knee stays stacked",
      "Keep one leg stationary with the knee bent about 90 degrees and stacked above the hip.",
      "knee_R.flex",
      "peak",
      70,
      115,
    ),
    checkJointWithinAt(
      "low-back-flat",
      "Lower back stays flat",
      "Brace your core so there is no space to slide a hand under your lower back.",
      "lumbar.flex",
      "peak",
      2,
      24,
    ),
  ],
});
