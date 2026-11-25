import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Palms on the fronts of the thighs, elbows straight, arms aimed at the floor. */
const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 8,
};

const UP = {
  ...POSTURE_HINTS.standing,
  ...ARMS,
  "shoulder.elev": 14,
  "lumbar.flex": -4,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "knee.flex": 4,
};

const DOWN = {
  ...UP,
  "root.y": 0.8,
  "root.z": -0.08,
  "root.pitch": 48,
  "hip.flex": 62,
  "knee.flex": 8,
  "shoulder.elev": 62,
  "wrist.flex": 12,
  "lumbar.flex": 30,
  "thoracic.flex": 18,
  "neck.flex": 28,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-jefferson-curl",
  catalogId: "1ec5c6f170d880ba8e43cf305531982d",
  name: "Bodyweight Jefferson Curl",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Curl", "Rounded", "Uncoil", "Upright"],
  tempo: { lower: 2.6, bottom: 0.35, raise: 2.2, top: 0.45 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 4 },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 4, thoracic: 3.6, neck: 2, hip: 1.2, elbow: 5, knee: 3 },
  hints: { start: UP, end: DOWN },
  checks: () => [
    checkJointRange(
      "neck-tuck",
      "Chin tucks to the chest",
      "Tuck the chin, then round each segment of the spine until the whole back is flexed.",
      "neck.flex",
      20,
    ),
    checkJointRange(
      "thoracic-round",
      "Upper back rounds",
      "Round the upper back along with the lower back. The hands travel down toward the floor.",
      "thoracic.flex",
      14,
    ),
    checkJointRange(
      "lumbar-round",
      "Lower back rounds",
      "Bend over by rounding the whole back through a comfortable range while the knees stay straight.",
      "lumbar.flex",
      28,
    ),
    checkJointRange(
      "hip-flex",
      "Hips flex with the curl",
      "The hips flex as the spine rounds. How far you descend depends on hamstring and spinal mobility.",
      "hip_L.flex",
      35,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows stay straight",
      "Keep the elbows straight and the arms directed down toward the ground.",
      "elbow_L.flex",
      "bottom",
      0,
      20,
    ),
  ],
});
