import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TABLETOP = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.13,
  "root.pitch": -88,
  "lumbar.flex": 10,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "hip.abd": 8,
  "ankle.dorsi": 0,
  "shoulder.twist": 8,
  "forearm.pron": 0,
  "elbow.flex": 4,
  "wrist.flex": 0,
};

/** Arms stacked over the shoulders, knees stacked over the hips. */
const START = {
  ...TABLETOP,
  "hip.flex": 92,
  "knee.flex": 92,
  "shoulder.elev": 92,
  "shoulder.plane": 88,
};

/** Left peak: left arm reaches overhead while the right leg reaches long. */
const PEAK = sidedHints(
  "L",
  {
    "shoulder.elev": 165,
    "shoulder.plane": 80,
    "elbow.flex": 6,
    "hip.flex": 92,
    "knee.flex": 92,
  },
  {
    "shoulder.elev": 92,
    "shoulder.plane": 88,
    "elbow.flex": 4,
    "hip.flex": 16,
    "knee.flex": 8,
  },
  {
    ...TABLETOP,
    "lumbar.flex": 10,
    "thoracic.flex": 4,
  },
);

export const spec = buildExerciseSpec({
  id: "dead-bug",
  catalogId: "2775c6f170d8801eb7ccd455a85f58ff",
  name: "Dead Bug",
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
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Press your lower back lightly into the floor to flatten it, and continue doing so throughout your set. All the movement should occur from the shoulder, hip, and knee as your spine remains motionless.",
      8,
    ),
    checkJointRange(
      "arm-sweep",
      "One arm sweeps back toward the floor",
      "Sweep one arm backward and downward while keeping the elbow straight, and keep the other arm stacked over the shoulder.",
      "shoulder_L.elev",
      50,
    ),
    checkJointRange(
      "leg-reach",
      "The opposite leg reaches long toward the floor",
      "Straighten the opposite leg and lower it toward the ground while keeping the other knee stacked above the hip.",
      "hip_R.flex",
      40,
    ),
    checkJointWithinAt(
      "knee-returns-bent",
      "The stationary knee stays near 90 degrees",
      "At the top, both knees should be stacked vertically above the hips, with the moving knee bending back to about 90 degrees.",
      "knee_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "low-back-flat",
      "Lower back stays pressed into the floor",
      "Brace your core so you cannot slide a hand under your lower back.",
      "lumbar.flex",
      "peak",
      0,
      22,
    ),
  ],
});
