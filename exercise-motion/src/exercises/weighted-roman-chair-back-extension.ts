import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const ARMS = {
  "shoulder.elev": 28,
  "shoulder.plane": 86,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 4,
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
  "shoulder.elev": 62,
  "shoulder.plane": 78,
};

export const spec = buildExerciseSpec({
  id: "weighted-roman-chair-back-extension",
  catalogId: "2725c6f170d880dda8f1c9962231c038",
  name: "Weighted Roman Chair Back Extension",
  defaultLoadKg: 5,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Flexed", "Extend", "Neutral"],
  tempo: { lower: 2.3, bottom: 0.3, raise: 2, top: 0.4 },
  station: { kind: "roman-chair", padY: 0.9 },
  apparatus: { kind: "medball", twoHandsOnOne: true },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.9, 0.04), 140)],
  stiffness: { lumbar: 14, thoracic: 10, hip: 8, knee: 6, elbow: 5 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "Hold the weight to the chest, round the whole back, then extend it without hinging at the hips.",
      "lumbar.flex",
      18,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together.",
      "thoracic.flex",
      14,
    ),
    checkJointWithinAt(
      "hips-set",
      "Hips stay in the hinge",
      "The hinge only sets the start. The reps move the spine.",
      "hip_L.flex",
      "bottom",
      16,
      50,
    ),
    checkJointWithinAt(
      "plate-at-chest",
      "Ball stays in the hands",
      "Hold the medicine ball with both hands and keep it in front of the torso.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkNeutralNeck("Keep the neck near neutral through the curl and the extension.", 16),
  ],
});
