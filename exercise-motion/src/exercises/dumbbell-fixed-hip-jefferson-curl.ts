import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Palms beside the outer front of the thighs, elbows straight, arms hanging plumb. */
const ARMS = {
  "shoulder.plane": 68,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 48,
  "wrist.flex": 4,
};

const DEFICIT = 0.12;

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86 + DEFICIT,
  "root.z": -0.08,
  "root.pitch": 56,
  "hip.flex": 76,
  "knee.flex": 16,
  "ankle.dorsi": 4,
  ...ARMS,
  "shoulder.elev": 56,
  "lumbar.flex": -2,
  "thoracic.flex": 2,
  "neck.flex": 4,
};

const ROUND = {
  ...HINGE,
  "root.pitch": 62,
  "hip.flex": 78,
  "knee.flex": 16,
  "shoulder.elev": 74,
  "lumbar.flex": 30,
  "thoracic.flex": 18,
  "neck.flex": 22,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-fixed-hip-jefferson-curl",
  catalogId: "3275c6f170d880749691dfb12167a6bd",
  name: "Dumbbell Fixed-Hip Jefferson Curl",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Flexed", "Uncoil", "Flat back"],
  tempo: { lower: 2.4, bottom: 0.3, raise: 2.2, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.14,
    toeOutDeg: 6,
    box: { height: DEFICIT, width: 0.55, depth: 0.46, z: 0.02 },
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { lumbar: 2.2, thoracic: 2, neck: 1.4, hip: 10, knee: 8, elbow: 5 },
  hints: { start: HINGE, end: ROUND },
  checks: () => [
    checkJointWithinAt(
      "hips-fixed",
      "Hips stay hinged",
      "Keep the hinged hip position while the spine rounds and uncoils. Do not drop the hips.",
      "hip_L.flex",
      "bottom",
      66,
      92,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds",
      "Round the lower back through a comfortable range without moving the lower body.",
      "lumbar.flex",
      26,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds with it",
      "Round the lower, middle, and upper back together, bringing the ribs toward the hip bones.",
      "thoracic.flex",
      14,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay mildly bent",
      "A mild knee bend comes from the hinge. Do not bend the knees further as the back rounds.",
      "knee_L.flex",
      "bottom",
      8,
      28,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms hang straight down",
      "Keep the elbows straight and the arms vertical, perpendicular to the ground.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
  ],
});
