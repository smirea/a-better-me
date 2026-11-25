import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Dumbbell held on the top hip. A plate, kettlebell, or vest is the same hold. */
const BASE = {
  "root.x": -0.22,
  "root.y": 0.7,
  "root.z": 0.02,
  "root.roll": 90,
  "root.pitch": 0,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 10,
  "hip_R.abd": 28,
  "hip_L.abd": 8,
  "shoulder_R.elev": 90,
  "shoulder_R.plane": 0,
  "shoulder_R.twist": 80,
  "elbow_R.flex": 90,
  "forearm_R.pron": 40,
  "wrist_R.flex": -12,
};

const TOP_ARM = {
  "shoulder.elev": 22,
  "shoulder.plane": 28,
  "elbow.flex": 18,
  "forearm.pron": 70,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "weighted-side-plank",
  catalogId: "35a5c6f170d880e98cf5d110e1131632",
  name: "Weighted Side Plank",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  grip: "hang",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Brace", "Hold", "Hold"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "side",
    feetOnFloor: false,
    passiveJoints: ["lumbar", "thoracic", "neck"],
  },
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(-0.14, 0.68, 0.02), 90, "y"),
    pin(body, "forearmMid_R", () => new Vector3(-0.4, 0.06, 0.04), 24, "y"),
  ],
  apparatus: { kind: "dumbbells", sides: ["L"] },
  stiffness: { hip: 8, lumbar: 12, thoracic: 10, shoulder: 8, elbow: 8, knee: 8 },
  hints: {
    start: sidedHints("L", TOP_ARM, {}, BASE),
    end: sidedHints("L", TOP_ARM, {}, BASE),
  },
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
      "weight-arm",
      "Top arm holds the weight on the hip",
      "Keep the weight against the top thigh or hip with the top elbow nearly straight.",
      "elbow_L.flex",
      "start",
      0,
      36,
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
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep the legs stacked and straight, as they would be standing with the feet together.",
      "knee_R.flex",
      "start",
      0,
      16,
    ),
  ],
});
