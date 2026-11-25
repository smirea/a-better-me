import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { keepAbove, pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 70,
  "elbow.flex": 6,
  "forearm.pron": 55,
  "wrist.flex": 0,
};

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.11,
  "root.pitch": -88,
  "lumbar.flex": 8,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 8,
  "hip.abd": 8,
  "knee.flex": 8,
  "ankle.dorsi": -6,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.16,
  "root.z": 0.04,
  "root.pitch": -70,
  "lumbar.flex": 36,
  "thoracic.flex": 8,
  "hip.flex": 78,
  "knee.flex": 22,
  "ankle.dorsi": 4,
};

export const spec = buildExerciseSpec({
  id: "straight-leg-reverse-crunch",
  catalogId: "1f55c6f170d8800b85b4c61116d095a6",
  name: "Straight Leg Reverse Crunch",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lower", "Lift", "Curl", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "shoulder", "elbow", "neck"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, hip: 5, knee: 4 },
  extraGoals: (body) => [keepAbove(body, "grip_L", 0.03, 80), keepAbove(body, "grip_R", 0.03, 80)],
  extraKeyGoals: (body) => ({
    end: [pin(body, "sacrum", () => new Vector3(0, 0.14, 0.02), 110, "y")],
  }),
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "legs-lift",
      "Straight legs lift toward vertical",
      "Lift both legs off the ground until your thighs are approximately vertical, only allowing your knees to bend mildly.",
      "hip_L.flex",
      55,
    ),
    checkJointRange(
      "pelvis-curl",
      "Lower back curls and the hips leave the floor",
      "Drive your buttocks and hip bones up off the floor while curling up your lower back, which will lift your legs higher.",
      "lumbar.flex",
      16,
    ),
    checkJointWithinAt(
      "knees-near-straight",
      "Knees stay nearly straight",
      "Keep your knees as close to straight as you can without your hamstring flexibility restricting your range of motion.",
      "knee_L.flex",
      "peak",
      0,
      30,
    ),
    checkAnchorTravel(
      "legs-rise",
      "Legs rise as the lower back curls",
      "Drive your buttocks and hip bones up off the floor while curling up your lower back, which will lift your legs higher.",
      "heel_L",
      "y",
      0.35,
    ),
    checkJointWithinAt(
      "low-back-pressed",
      "Lower back presses into the floor before the curl",
      "Tighten your abs to press your lower back down into the ground as you lift and lower your legs.",
      "lumbar.flex",
      "start",
      0,
      20,
    ),
  ],
});
