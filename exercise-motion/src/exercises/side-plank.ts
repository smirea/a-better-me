import { buildExerciseSpec } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkJointWithinAt } from "../postures";

/**
 * Right side down. Roll puts the right arm and right foot toward the floor.
 * Bottom hip abduction drops that foot to the mat while the torso stays long.
 */
const HOLD = {
  "root.x": -0.22,
  "root.y": 0.6,
  "root.z": 0.02,
  "root.roll": 90,
  "root.pitch": 0,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 10,
  "hip_R.abd": 24,
  "hip_L.abd": 8,
  "shoulder_R.elev": 90,
  "shoulder_R.plane": 0,
  "shoulder_R.twist": 80,
  "elbow_R.flex": 90,
  "forearm_R.pron": 40,
  "wrist_R.flex": -12,
  "shoulder_L.elev": 16,
  "shoulder_L.plane": 36,
  "elbow_L.flex": 48,
  "forearm_L.pron": 16,
};

export const spec = buildExerciseSpec({
  id: "side-plank",
  catalogId: "1a45c6f170d88034bc94c6276f361442",
  name: "Side Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Brace", "Hold", "Hold"],
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.8, 2.2, 0.1),
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_R", bodyweightShare: 0.34, grip: "press", direction: [0, 1, 0] },
      { anchor: "ballOut_R", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
    ],
  },
  stiffness: { hip: 8, lumbar: 12, thoracic: 10, shoulder: 10, elbow: 8, knee: 8 },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkJointWithinAt(
      "elbow-under-shoulder",
      "Bottom elbow stays bent",
      "Stack the bottom elbow under the shoulder with the forearm on the mat.",
      "elbow_R.flex",
      "start",
      70,
      110,
    ),
    checkJointWithinAt(
      "body-line",
      "Hips stay extended",
      "Lift the bottom hip so the legs, torso, and head stay in one line.",
      "hip_R.flex",
      "start",
      -12,
      16,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep both legs straight, one stacked on the other.",
      "knee_R.flex",
      "start",
      0,
      16,
    ),
    checkJointWithinAt(
      "hips-up",
      "Bottom hip stays lifted",
      "Push through the bottom foot and forearm so the lower hip does not sag.",
      "hip_R.abd",
      "start",
      14,
      40,
    ),
  ],
});
