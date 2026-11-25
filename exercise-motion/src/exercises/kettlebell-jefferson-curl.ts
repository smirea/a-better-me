import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Both hands on one bell, palms back, elbows straight, bell in front of the thighs. */
const ARMS = {
  "shoulder.plane": 84,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

const UP = {
  ...POSTURE_HINTS.standing,
  ...ARMS,
  "shoulder.elev": 16,
  "lumbar.flex": -4,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "knee.flex": 4,
};

const DOWN = {
  ...UP,
  "root.y": 0.8,
  "root.z": -0.06,
  "root.pitch": 44,
  "hip.flex": 58,
  "knee.flex": 8,
  "shoulder.elev": 62,
  "lumbar.flex": 28,
  "thoracic.flex": 18,
  "neck.flex": 28,
};

export const spec = buildExerciseSpec({
  id: "kettlebell-jefferson-curl",
  catalogId: "1a15c6f170d880c2b857e1479cb1c933",
  name: "Kettlebell Jefferson Curl",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Rounded", "Uncoil", "Upright"],
  tempo: { lower: 2.6, bottom: 0.35, raise: 2.2, top: 0.45 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 6 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  stiffness: { lumbar: 4, thoracic: 3.6, neck: 2, hip: 1.2, elbow: 5, knee: 3 },
  hints: { start: UP, end: DOWN },
  checks: () => [
    checkJointRange(
      "neck-tuck",
      "Chin tucks first",
      "Tuck the chin to the chest before the rest of the spine rounds.",
      "neck.flex",
      20,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds",
      "Round the upper back with the lower back while the kettlebell hangs toward the floor.",
      "thoracic.flex",
      16,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds",
      "Lower the kettlebell by rounding the whole back through a comfortable range.",
      "lumbar.flex",
      26,
    ),
    checkJointRange(
      "hip-flex",
      "Hips flex with the curl",
      "The hips flex as the spine rounds. Keep the knees and elbows straight.",
      "hip_L.flex",
      32,
    ),
    checkJointWithinAt(
      "straight-knees",
      "Knees stay nearly straight",
      "Keep the knees straightened and the arms directed down toward the ground.",
      "knee_L.flex",
      "bottom",
      -4,
      18,
    ),
  ],
});
