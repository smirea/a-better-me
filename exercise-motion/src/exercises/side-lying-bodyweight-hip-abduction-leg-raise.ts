import { buildExerciseSpec, sidedHints } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Bottom leg marches toward the chest so the straight top leg can lower to the mat. */
const LYING = {
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
  "hip_R.flex": 62,
  "hip_R.abd": 16,
  "knee_R.flex": 80,
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
  id: "side-lying-bodyweight-hip-abduction-leg-raise",
  catalogId: "1a35c6f170d880918125e6387c3849d5",
  name: "Side-Lying Bodyweight Hip Abduction Leg Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lift", "Up", "Lower", "Down"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 1.3, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.8, 2.0, 0.1),
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_R", bodyweightShare: 0.34, grip: "press", direction: [0, 1, 0] },
      { anchor: "pelvisBottom", bodyweightShare: 0.22, grip: "rest", direction: [0, 1, 0] },
    ],
  },
  stiffness: { hip: 4, knee: 8, lumbar: 8 },
  hints: {
    start: sidedHints("L", { "hip.flex": 6, "hip.abd": 6 }, {}, LYING),
    end: sidedHints("L", { "hip.flex": 6, "hip.abd": 40 }, {}, LYING),
  },
  checks: () => [
    checkJointWithinAt(
      "bottom-leg-tucked",
      "Bottom thigh stays toward the chest",
      "Keep the bottom knee bent and that thigh marched in so the top foot can reach the mat.",
      "hip_R.flex",
      "peak",
      48,
      90,
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
      "no-roll-forward",
      "Top thigh does not come forward",
      "Lift straight up. Do not roll the hips back or bring the top leg toward the chest.",
      "hip_L.flex",
      "peak",
      -6,
      18,
    ),
    checkJointRange(
      "abduction",
      "Top leg abducts",
      "Raise the top leg through the hip’s range, then lower the inner foot to the mat.",
      "hip_L.abd",
      18,
    ),
  ],
});
