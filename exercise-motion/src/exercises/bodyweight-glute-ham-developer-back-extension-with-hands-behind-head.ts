import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Fingertips at the sides of the head, elbows out. */
const ARMS = {
  "shoulder.elev": 68,
  "shoulder.plane": 42,
  "shoulder.twist": 22,
  "elbow.flex": 112,
  "forearm.pron": -12,
  "wrist.flex": 6,
  "clavicle.elev": 8,
};

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
  id: "bodyweight-glute-ham-developer-back-extension-with-hands-behind-head",
  catalogId: "2725c6f170d8806fa867d75416d72046",
  name: "Bodyweight Glute Ham Developer Back Extension With Hands Behind Head",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Round", "Flexed", "Extend", "Neutral"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 3, thoracic: 2.6, hip: 8, knee: 10, ankle: 14, elbow: 4 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointWithinAt(
      "hands-behind-head",
      "Hands stay behind the head",
      "Keep the fingertips lightly on the sides of the back of the head, with the elbows out.",
      "elbow_L.flex",
      "peak",
      90,
      135,
    ),
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "Round the entire back, then extend it without hinging at the hips.",
      "lumbar.flex",
      28,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back, then straighten them together.",
      "thoracic.flex",
      16,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Hips stay on the pad",
      "Move the spine rather than the hips, and keep the glutes as relaxed as you can.",
      "hip_L.flex",
      "bottom",
      4,
      32,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, as when standing upright and looking straight ahead.",
      16,
    ),
  ],
});
