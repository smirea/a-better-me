import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "shoulder.plane": 80,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 4,
};

const DEFICIT = 0.12;

/** Hinged, flat-backed Romanian-deadlift bottom. The rep only moves the spine from here. */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86 + DEFICIT,
  "root.z": -0.08,
  "root.pitch": 58,
  "hip.flex": 78,
  "hip.abd": 4,
  "knee.flex": 16,
  "ankle.dorsi": 4,
  ...ARMS,
  "shoulder.elev": 58,
  "lumbar.flex": -2,
  "thoracic.flex": 2,
  "neck.flex": 4,
};

const ROUND = {
  ...HINGE,
  "root.y": 0.84 + DEFICIT,
  "root.pitch": 64,
  "hip.flex": 80,
  "knee.flex": 16,
  "shoulder.elev": 78,
  "lumbar.flex": 30,
  "thoracic.flex": 18,
  "neck.flex": 24,
};

export const spec = buildExerciseSpec({
  id: "barbell-fixed-hip-jefferson-curl",
  catalogId: "3275c6f170d88015ba26d7b441303f44",
  name: "Barbell Fixed-Hip Jefferson Curl",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Flexed", "Uncoil", "Flat back"],
  tempo: { lower: 2.4, bottom: 0.3, raise: 2.2, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.13,
    toeOutDeg: 6,
    box: { height: DEFICIT, width: 0.55, depth: 0.46, z: 0.02 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.48 + DEFICIT, startZ: 0.28, endY: 0.18, endZ: 0.4, arcBulgeZ: 0.02 },
  },
  stiffness: { lumbar: 2.2, thoracic: 2, neck: 1.4, hip: 10, knee: 8, elbow: 5 },
  hints: { start: HINGE, end: ROUND },
  checks: () => [
    checkJointWithinAt(
      "hips-fixed",
      "Hips stay in the hinge",
      "Once the hamstrings are at their comfortable end range, round the back without moving the hips or knees.",
      "hip_L.flex",
      "bottom",
      68,
      92,
    ),
    checkJointWithinAt(
      "hips-set",
      "Hinge is set before the curl",
      "Sit the hips back with a flat back first. The curl itself does not add more hip flexion.",
      "hip_L.flex",
      "start",
      65,
      92,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds with the hips still",
      "Round the lower back by bringing the bottom of the ribs toward the top of the hip bones.",
      "lumbar.flex",
      18,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together. Most of the motion is still in the lower half.",
      "thoracic.flex",
      16,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay mildly bent",
      "Allow a mild knee bend from the hinge, and do not drop the hips by bending the knees further as the spine rounds.",
      "knee_L.flex",
      "bottom",
      8,
      28,
    ),
  ],
});
