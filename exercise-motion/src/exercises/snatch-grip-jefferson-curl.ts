import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Wide overhand snatch grip, elbows straight, arms angled out from the torso. */
const ARMS = {
  "shoulder.plane": 55,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 4,
};

const DEFICIT = 0.1;

const UP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.943 + DEFICIT,
  "root.z": 0.02,
  ...ARMS,
  "shoulder.elev": 28,
  "lumbar.flex": -4,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "knee.flex": 4,
};

const DOWN = {
  ...UP,
  "root.y": 0.8 + DEFICIT,
  "root.z": -0.04,
  "root.pitch": 38,
  "hip.flex": 52,
  "knee.flex": 8,
  "shoulder.elev": 68,
  "lumbar.flex": 28,
  "thoracic.flex": 18,
  "neck.flex": 28,
};

export const spec = buildExerciseSpec({
  id: "snatch-grip-jefferson-curl",
  catalogId: "1ec5c6f170d880cba79eedde0d89a8c1",
  name: "Snatch Grip Jefferson Curl",
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
    gripX: 0.4,
    path: { startY: 0.78 + DEFICIT, startZ: 0.18, endY: 0.36, endZ: 0.34, arcBulgeZ: 0.03 },
  },
  stiffness: { lumbar: 4, thoracic: 3.6, neck: 2, hip: 1.2, elbow: 5, knee: 3, shoulder: 0.8 },
  hints: { start: UP, end: DOWN },
  checks: () => [
    checkJointWithinAt(
      "snatch-grip",
      "Hands sit in a wide snatch grip",
      "Spread the arms until each arm forms close to a 45-degree angle with the torso, then grip the bar overhand.",
      "shoulder_L.plane",
      "start",
      35,
      75,
    ),
    checkJointRange(
      "neck-tuck",
      "Chin tucks first",
      "Tuck the chin, then round the spine segment by segment.",
      "neck.flex",
      18,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds",
      "Round the upper back along with the lower back until the whole spine is flexed.",
      "thoracic.flex",
      16,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds",
      "Lower the bar by rounding the whole back through a comfortable range while the knees stay straight.",
      "lumbar.flex",
      26,
    ),
    checkJointRange(
      "hip-flex",
      "Hips flex with the spinal curl",
      "The hips flex as the spine rounds. The arms stay directed down toward the ground.",
      "hip_L.flex",
      30,
    ),
  ],
});
