import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Plate on the top thigh, elbow straight. An ankle weight is the same leg path. */
const LYING = {
  "root.x": -0.22,
  "root.y": 0.6,
  "root.z": 0.02,
  "root.roll": 90,
  "root.pitch": 0,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "knee.flex": 4,
  "ankle.dorsi": 10,
  "hip_R.flex": 62,
  "hip_R.abd": 16,
  "knee_R.flex": 80,
  "shoulder_R.elev": 90,
  "shoulder_R.plane": 0,
  "shoulder_R.twist": 80,
  "elbow_R.flex": 90,
  "forearm_R.pron": 40,
  "wrist_R.flex": -12,
};

const TOP_ARM = {
  "shoulder.elev": 18,
  "shoulder.plane": 16,
  "elbow.flex": 10,
  "forearm.pron": 64,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "side-lying-weighted-hip-abduction-leg-raise",
  catalogId: "1a35c6f170d880bd90eae6df2f7527e8",
  name: "Side-Lying Weighted Hip Abduction Leg Raise",
  defaultLoadKg: 2,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lift", "Up", "Lower", "Down"],
  tempo: { lower: 1.3, bottom: 0.2, raise: 1.4, top: 0.25 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "side",
    feetOnFloor: false,
    passiveJoints: ["lumbar", "thoracic", "neck"],
  },
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(-0.14, 0.6, 0.02), 80, "y"),
    pin(body, "forearmMid_R", () => new Vector3(-0.4, 0.06, 0.04), 24, "y"),
  ],
  apparatus: { kind: "plate", sides: ["L"] },
  extraContacts: { plate: { thigh_L: 0.04, shank_L: 0.03 } },
  stiffness: { hip: 4, knee: 8, lumbar: 8, elbow: 8 },
  hints: {
    start: sidedHints("L", { "hip.flex": 6, "hip.abd": 6, ...TOP_ARM }, {}, LYING),
    end: sidedHints("L", { "hip.flex": 6, "hip.abd": 38, ...TOP_ARM }, {}, LYING),
  },
  checks: () => [
    checkJointWithinAt(
      "plate-arm",
      "Arm stays straight on the thigh",
      "Keep the weight on the top thigh and the elbow straight.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "top-knee-straight",
      "Top knee stays straight",
      "Lift the top leg with a straight knee, in line with the torso.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "bottom-leg-tucked",
      "Bottom thigh stays toward the chest",
      "Keep the bottom knee bent so the top foot can meet the mat.",
      "knee_R.flex",
      "peak",
      55,
      100,
    ),
    checkJointRange(
      "abduction",
      "Top leg abducts",
      "Raise the weighted leg straight up, then lower the inner foot to the mat.",
      "hip_L.abd",
      16,
    ),
  ],
});
