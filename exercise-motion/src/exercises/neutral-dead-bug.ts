import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Mild standing lordosis, held still. Not a flattened low back. */
const TABLETOP = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.13,
  "root.pitch": -88,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.abd": 8,
  "ankle.dorsi": 0,
  "shoulder.twist": 6,
  "forearm.pron": 0,
  "elbow.flex": 4,
  "wrist.flex": 0,
};

const START = {
  ...TABLETOP,
  "hip.flex": 92,
  "knee.flex": 92,
  "shoulder.elev": 92,
  "shoulder.plane": 88,
};

/** Right arm and left leg reach long. The other arm and leg stay stacked. */
const PEAK = sidedHints(
  "L",
  {
    "shoulder.elev": 92,
    "shoulder.plane": 88,
    "elbow.flex": 4,
    "hip.flex": 14,
    "knee.flex": 8,
  },
  {
    "shoulder.elev": 164,
    "shoulder.plane": 80,
    "elbow.flex": 6,
    "hip.flex": 92,
    "knee.flex": 92,
  },
  { ...TABLETOP },
);

export const spec = buildExerciseSpec({
  id: "neutral-dead-bug",
  catalogId: "1a45c6f170d88051b565eb1ea43255bc",
  name: "Neutral Dead Bug",
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
    passiveJoints: ["ankle", "neck", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 20, thoracic: 16, hip: 2, shoulder: 1.4 },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Rigidly maintain the natural curvature of your lower back throughout the entire exercise. All the movement should occur from your shoulder, hip, and knee as your spine remains motionless.",
      8,
    ),
    checkJointRange(
      "arm-sweep",
      "One arm sweeps back toward the floor",
      "Sweep one arm backward and downward while keeping the elbow straight, and keep the other arm stacked over the shoulder.",
      "shoulder_R.elev",
      48,
    ),
    checkJointRange(
      "leg-reach",
      "The opposite leg reaches long toward the floor",
      "Straighten the opposite leg and lower it toward the ground while keeping the other knee stacked above the hip.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "neutral-arch-holds",
      "Lower back keeps its natural arch",
      "Your lower back should stay near the natural mild curvature you have when standing, rather than being excessively arched or flattened.",
      "lumbar.flex",
      "peak",
      -18,
      8,
    ),
    checkJointWithinAt(
      "knee-stays-stacked",
      "The stationary knee stays near 90 degrees",
      "At the top, both of your knees should be stacked vertically above your hips.",
      "knee_R.flex",
      "peak",
      70,
      115,
    ),
  ],
});
