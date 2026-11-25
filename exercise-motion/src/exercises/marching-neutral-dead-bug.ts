import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** One hand under the low back, the other resting on the abdomen. Both stay put. */
const HANDS = {
  "shoulder_L.elev": 28,
  "shoulder_L.plane": 70,
  "shoulder_L.twist": 20,
  "elbow_L.flex": 108,
  "forearm_L.pron": -20,
  "wrist_L.flex": 6,
  "shoulder_R.elev": 18,
  "shoulder_R.plane": -40,
  "shoulder_R.twist": -10,
  "elbow_R.flex": 70,
  "forearm_R.pron": 40,
  "wrist_R.flex": 0,
};

const TABLETOP = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.13,
  "root.pitch": -88,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.abd": 8,
  "ankle.dorsi": 0,
  ...HANDS,
};

const START = {
  ...TABLETOP,
  "hip.flex": 92,
  "knee.flex": 92,
};

/** Left leg reaches long. The right leg and both arms stay stacked. */
const PEAK = sidedHints(
  "L",
  { "hip.flex": 14, "knee.flex": 10 },
  { "hip.flex": 92, "knee.flex": 92 },
  TABLETOP,
);

export const spec = buildExerciseSpec({
  id: "marching-neutral-dead-bug",
  catalogId: "2775c6f170d880fd8e05f7964e101ea3",
  name: "Marching Neutral Dead Bug",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Tabletop", "Reach", "Return", "Reach"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "neck", "wrist", "shoulder", "elbow"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 20, thoracic: 16, hip: 2, knee: 2, shoulder: 6, elbow: 6 },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Rigidly maintain the natural curvature of your lower back. All the movement should occur from your hip and knee as your spine remains motionless.",
      8,
    ),
    checkJointRange(
      "leg-reaches",
      "One leg reaches long toward the floor",
      "While keeping one leg stationary, slowly lower your other leg toward the ground while straightening its knee.",
      "hip_L.flex",
      45,
    ),
    checkJointRange(
      "knee-straightens",
      "The moving knee straightens",
      "With sufficient core control, finish with that leg parallel to the ground and the knee straightened, then march it back up.",
      "knee_L.flex",
      45,
    ),
    checkJointWithinAt(
      "other-knee-stays",
      "The stationary knee stays stacked",
      "At the top, both of your knees should be stacked vertically above your hips. Only one leg moves each rep.",
      "knee_R.flex",
      "peak",
      70,
      115,
    ),
    checkJointWithinAt(
      "neutral-arch-holds",
      "Lower back keeps its natural arch",
      "Your lower back should stay near the natural mild curvature you have when standing. A normal arch still lets you feel your lower back with the hand that stays on the ground.",
      "lumbar.flex",
      "peak",
      -18,
      8,
    ),
  ],
});
