import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { flatBench } from "../equipment";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const BENCH_Y = 0.46;
const BENCH = flatBench({ topY: BENCH_Y, zHead: -0.42, zFoot: 0.95 });

const GRIP = {
  "shoulder.elev": 150,
  "shoulder.plane": 68,
  "shoulder.twist": 18,
  "elbow.flex": 86,
  "forearm.pron": 65,
  "wrist.flex": 6,
};

const DOWN = {
  "root.y": 0.54,
  "root.z": 0.02,
  "root.pitch": -84,
  "lumbar.flex": 8,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.flex": 10,
  "hip.abd": 4,
  "knee.flex": 8,
  "ankle.dorsi": -4,
  ...GRIP,
};

const UP = {
  ...DOWN,
  "root.y": 0.86,
  "root.z": -0.02,
  "root.pitch": -50,
  "lumbar.flex": 46,
  "thoracic.flex": 18,
  "hip.flex": 108,
  "knee.flex": 14,
};

export const spec = buildExerciseSpec({
  id: "modified-candlestick",
  catalogId: "2a15c6f170d880d299bcc63091b71c62",
  name: "Modified Candlestick",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Lie", "Lift", "Curl", "Lower"],
  ground: "upperBack",
  station: { kind: "cardio", machine: "none" },
  extraEquipment: BENCH,
  extraContacts: {
    "bench.pad": {
      chest: 0.05,
      girdle: 0.045,
      pelvis: 0.045,
      head: 0.12,
      neck: 0.1,
      abdomen: 0.04,
      thigh_L: 0.04,
      thigh_R: 0.04,
      hand_L: 0.07,
      hand_R: 0.07,
    },
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, hip: 4, knee: 5, shoulder: 3, elbow: 4 },
  extraGoals: (body) => [
    pin(body, "upperBack", () => new Vector3(0, BENCH_Y - 0.015, -0.16), 30, "y"),
    pin(body, "grip_L", () => new Vector3(0.18, BENCH_Y - 0.08, -0.46), 16),
    pin(body, "grip_R", () => new Vector3(-0.18, BENCH_Y - 0.08, -0.46), 16),
  ],
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "legs-rise",
      "Straight legs lift toward vertical",
      "Tighten your abdominal muscles and lift your legs until your thighs are approximately vertical, keeping your knees mostly straight.",
      "hip_L.flex",
      12,
    ),
    checkJointRange(
      "back-curls-off",
      "Buttocks and middle back leave the bench",
      "While keeping your legs directed up, lift your buttocks, lower back, and middle back off the bench until you bear weight through your upper back.",
      "lumbar.flex",
      6,
    ),
    checkJointWithinAt(
      "knees-near-straight",
      "Knees stay nearly straight",
      "Strive to keep your knees as close to straight as your hamstring flexibility comfortably permits.",
      "knee_L.flex",
      "peak",
      0,
      32,
    ),
    checkAnchorTravel(
      "hips-leave-bench",
      "Hips rise off the bench",
      "Your buttocks should leave the bench at the top and only return when the legs have arced back down toward the bench.",
      "sacrum",
      "y",
      0.04,
    ),
    checkJointWithinAt(
      "hands-hold",
      "Hands keep hold of the bench",
      "Reach behind your head and grasp the bench, and continue holding on for stability throughout the exercise.",
      "elbow_L.flex",
      "peak",
      50,
      120,
    ),
  ],
});
