import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "shoulder.plane": 84,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "shoulder.abd": 6,
  "forearm.pron": 72,
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
  id: "kettlebell-fixed-hip-jefferson-curl",
  catalogId: "3275c6f170d880019380fe93ac3bd745",
  name: "Kettlebell Fixed-Hip Jefferson Curl",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Flexed", "Uncoil", "Flat back"],
  tempo: { lower: 2.4, bottom: 0.3, raise: 2.2, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.15,
    toeOutDeg: 6,
    box: { height: DEFICIT, width: 0.55, depth: 0.46, z: 0.02 },
  },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  stiffness: { lumbar: 2.2, thoracic: 2, neck: 1.4, hip: 10, knee: 8, elbow: 5, shoulder: 2.4 },
  hints: { start: HINGE, end: ROUND },
  checks: () => [
    checkJointWithinAt(
      "hips-fixed",
      "Hips stay hinged",
      "Maintain the hinged-hip position. All of the rep comes from extending and flexing the spine.",
      "hip_L.flex",
      "bottom",
      66,
      92,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds",
      "Round the lower back slowly without moving the hips or knees.",
      "lumbar.flex",
      26,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds with it",
      "Round the lower, middle, and upper back together.",
      "thoracic.flex",
      10,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay mildly bent",
      "Keep the mild knee bend from the hinge. Do not drop the hips as the back rounds.",
      "knee_L.flex",
      "bottom",
      8,
      28,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms hang straight down",
      "Keep the elbows straight and the arms vertical.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
  ],
});
