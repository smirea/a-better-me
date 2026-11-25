import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Plate hugged to the chest. */
const ARMS = {
  "shoulder.elev": 22,
  "shoulder.plane": 86,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 4,
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
  "lumbar.flex": 32,
  "thoracic.flex": 22,
  "neck.flex": 8,
  "shoulder.elev": 70,
  "shoulder.plane": 80,
};

export const spec = buildExerciseSpec({
  id: "weighted-glute-ham-developer-back-extension",
  catalogId: "2735c6f170d8806eb2e7cde530f136f1",
  name: "Weighted Glute Ham Developer Back Extension",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Round", "Flexed", "Extend", "Neutral"],
  tempo: { lower: 2.3, bottom: 0.3, raise: 2, top: 0.4 },
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "medball", twoHandsOnOne: true },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.96, 0.06), 70)],
  stiffness: { lumbar: 8, thoracic: 6, hip: 8, knee: 10, ankle: 14, elbow: 6, shoulder: 1.2 },
  hints: { start: LONG, end: ROUND },
  checks: () => [
    checkJointRange(
      "lumbar-curl",
      "Lower back rounds and extends",
      "Round the entire back under the plate, then extend it without hinging at the hips.",
      "lumbar.flex",
      26,
    ),
    checkJointRange(
      "thoracic-curl",
      "Upper back rounds with the lower back",
      "Round the lower, middle, and upper back together, thinking of the ribs moving toward the hip bones.",
      "thoracic.flex",
      14,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Hips stay braced on the pad",
      "Keep the front of the hips on the pad and move the spine rather than the hips.",
      "hip_L.flex",
      "bottom",
      4,
      32,
    ),
    checkJointWithinAt(
      "plate-at-chest",
      "Ball stays in the hands",
      "Hold the medicine ball with straight arms aimed toward the floor, which is one of the allowed grips.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkNeutralNeck(
      "Keep the neck near neutral while the back rounds and extends.",
      16,
    ),
  ],
});
