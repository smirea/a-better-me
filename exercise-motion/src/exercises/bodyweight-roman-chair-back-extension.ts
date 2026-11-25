import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const ARMS = {
  "shoulder.elev": 48,
  "shoulder.plane": 74,
  "shoulder.twist": 38,
  "elbow.flex": 124,
  "forearm.pron": 16,
  "wrist.flex": 6,
  "clavicle.elev": 4,
};

/** Already hinged over the pad with a flat back. The rep is the spinal curl. */
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
  id: "bodyweight-roman-chair-back-extension",
  catalogId: "1a15c6f170d880e98ddcce17a2c0ddd1",
  name: "Bodyweight Roman Chair Back Extension",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Round", "Flexed", "Extend", "Neutral"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.8, top: 0.4 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "none" },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 140)],
  stiffness: { lumbar: 14, thoracic: 10, hip: 8, knee: 6 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "After the hip hinge is set, round the whole back, then extend it without more hip motion.",
      "lumbar.flex",
      20,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together. Think of the ribs moving toward the hip bones.",
      "thoracic.flex",
      16,
    ),
    checkJointWithinAt(
      "hips-set",
      "Hips stay in the hinge",
      "The hinge only sets the start. During the reps, move the spine and keep the glutes relaxed.",
      "hip_L.flex",
      "bottom",
      16,
      50,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight on the foot plate",
      "Heels sit against the back of the foot plate with the knees straight.",
      "knee_L.flex",
      "peak",
      -6,
      18,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral, as when standing upright and looking straight ahead.",
      16,
    ),
  ],
});
