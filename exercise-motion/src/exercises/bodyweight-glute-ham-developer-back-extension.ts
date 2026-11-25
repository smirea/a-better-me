import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Arms crossed, each hand on the opposite shoulder. */
const ARMS = {
  "shoulder.elev": 48,
  "shoulder.plane": 74,
  "shoulder.twist": 38,
  "elbow.flex": 124,
  "forearm.pron": 16,
  "wrist.flex": 6,
  "clavicle.elev": 4,
};

/** Neutral spine, hips on the pad, torso unsupported and near horizontal. */
const LONG = {
  "root.y": 1.02,
  "root.z": 0.1,
  "root.pitch": 78,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 28,
  "ankle.dorsi": -6,
  "lumbar.flex": -10,
  "thoracic.flex": -4,
  "neck.flex": 2,
  ...ARMS,
};

const ROUND = {
  ...LONG,
  "root.y": 0.94,
  "root.z": 0.22,
  "root.pitch": 88,
  "hip.flex": 20,
  "lumbar.flex": 34,
  "thoracic.flex": 24,
  "neck.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-glute-ham-developer-back-extension",
  catalogId: "1a15c6f170d88078921cce8e88163f31",
  name: "Bodyweight Glute Ham Developer Back Extension",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Round", "Flexed", "Extend", "Neutral"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 3, thoracic: 2.6, hip: 8, knee: 10, ankle: 14 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "Round the entire back, then extend it without hinging at the hips. Finish near a neutral lower back.",
      "lumbar.flex",
      28,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together, then straighten them as one.",
      "thoracic.flex",
      16,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Hips stay on the pad",
      "Keep the glutes relaxed and move the spine rather than the hips.",
      "hip_L.flex",
      "bottom",
      4,
      32,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Soles stay on the footplate with the knees straight and the lower legs in the rollers.",
      "knee_L.flex",
      "peak",
      8,
      40,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, the way it sits when you stand upright and look straight ahead.",
      16,
    ),
  ],
});
