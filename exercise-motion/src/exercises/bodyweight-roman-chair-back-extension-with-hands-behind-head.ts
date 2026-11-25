import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

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
  "root.y": 0.98,
  "root.z": 0.24,
  "root.pitch": 18,
  "hip.flex": 28,
  "hip.abd": 6,
  "knee.flex": 8,
  "ankle.dorsi": 6,
  "lumbar.flex": -8,
  "thoracic.flex": -2,
  "neck.flex": 0,
  ...ARMS,
};

const ROUND = {
  ...LONG,
  "root.y": 0.94,
  "root.z": 0.3,
  "root.pitch": 26,
  "hip.flex": 34,
  "lumbar.flex": 22,
  "thoracic.flex": 22,
  "neck.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-roman-chair-back-extension-with-hands-behind-head",
  catalogId: "2725c6f170d88061b3fcd48c0e94e20c",
  name: "Bodyweight Roman Chair Back Extension With Hands Behind Head",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Round", "Flexed", "Extend", "Neutral"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "none" },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 140)],
  stiffness: { lumbar: 14, thoracic: 10, hip: 8, knee: 6, elbow: 4 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointWithinAt(
      "hands-behind-head",
      "Hands stay behind the head",
      "Fingertips stay on the sides of the back of the head, elbows out, for the whole set.",
      "elbow_L.flex",
      "peak",
      90,
      135,
    ),
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "Round the whole back from the hinged position, then extend it without hinging further.",
      "lumbar.flex",
      20,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together.",
      "thoracic.flex",
      16,
    ),
    checkJointWithinAt(
      "hips-set",
      "Hips stay in the hinge",
      "Move the spine rather than the hips once the pad and hamstrings have set the hinge.",
      "hip_L.flex",
      "bottom",
      16,
      50,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, as when standing upright and looking straight ahead.",
      16,
    ),
  ],
});
