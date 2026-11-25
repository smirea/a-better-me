import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Overhand grip, elbows straight, arms hanging toward the floor. */
const ARMS = {
  "shoulder.plane": 78,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 4,
};

/** Small deficit so a full spinal curl can finish before the bar meets the floor. */
const DEFICIT = 0.1;

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.943 + DEFICIT,
  "root.z": 0.02,
  ...ARMS,
  "shoulder.elev": 12,
  "lumbar.flex": -4,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "knee.flex": 4,
};

const DOWN = {
  ...UP,
  "root.y": 0.78 + DEFICIT,
  "root.z": -0.06,
  "root.pitch": 42,
  "hip.flex": 58,
  "knee.flex": 8,
  "ankle.dorsi": 4,
  "shoulder.elev": 64,
  "lumbar.flex": 28,
  "thoracic.flex": 18,
  "neck.flex": 28,
};

export const spec = buildExerciseSpec({
  id: "barbell-jefferson-curl",
  catalogId: "1a15c6f170d8801eba8df62057baf55a",
  name: "Barbell Jefferson Curl",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Rounded", "Uncoil", "Upright"],
  tempo: { lower: 2.6, bottom: 0.35, raise: 2.2, top: 0.45 },
  station: {
    kind: "standing",
    stanceX: 0.14,
    toeOutDeg: 6,
    box: { height: DEFICIT, width: 0.55, depth: 0.46, z: 0.02 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.7 + DEFICIT, startZ: 0.16, endY: 0.32, endZ: 0.32, arcBulgeZ: 0.04 },
  },
  stiffness: { lumbar: 4, thoracic: 3.6, neck: 2, hip: 1.2, elbow: 5, knee: 3 },
  hints: { start: UP, end: DOWN },
  checks: () => [
    checkJointRange(
      "neck-tuck",
      "Chin tucks as the curl starts",
      "Tuck your chin to your chest, then round each segment of the spine in turn.",
      "neck.flex",
      20,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds",
      "Round the middle and upper back, not only the lumbar spine, until the whole back is rounded.",
      "thoracic.flex",
      12,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds",
      "Lower the bar by bending over and rounding the whole back through a comfortable range.",
      "lumbar.flex",
      28,
    ),
    checkJointRange(
      "hip-flex",
      "Hips flex with the curl",
      "A standard Jefferson curl lets the hips flex as the spine rounds. Keep the knees nearly straight.",
      "hip_L.flex",
      35,
    ),
    checkJointWithinAt(
      "straight-knees",
      "Knees stay nearly straight",
      "Keep the knees and elbows straight while the arms hang down toward the ground.",
      "knee_L.flex",
      "bottom",
      -4,
      18,
    ),
  ],
});
