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
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 8,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 55,
  "hip.abd": 10,
  "knee.flex": 100,
  "ankle.dorsi": 6,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.18,
  "root.z": 0.02,
  "root.pitch": -68,
  "lumbar.flex": 38,
  "thoracic.flex": 10,
  "hip.flex": 118,
  "knee.flex": 108,
  "ankle.dorsi": 8,
};

export const spec = buildExerciseSpec({
  id: "bent-leg-reverse-crunch",
  catalogId: "1a45c6f170d880ff8f44dfd8ac3f86a2",
  name: "Bent-Leg Reverse Crunch",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Feet down", "Lift", "Curl", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "shoulder", "elbow", "neck"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, hip: 5 },
  extraGoals: (body) => [keepAbove(body, "grip_L", 0.03, 80), keepAbove(body, "grip_R", 0.03, 80)],
  extraKeyGoals: (body) => ({
    end: [pin(body, "sacrum", () => new Vector3(0, 0.14, 0.02), 110, "y")],
  }),
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "knees-to-face",
      "Bent knees travel toward the face",
      "Continue driving your bent knees toward your face while lifting your buttocks and hip bones up off the floor.",
      "hip_L.flex",
      35,
    ),
    checkJointRange(
      "pelvis-curl",
      "Lower back curls as the hips leave the floor",
      "Curl up your lower back so your buttocks face forward rather than straight down toward the ground.",
      "lumbar.flex",
      16,
    ),
    checkJointWithinAt(
      "knees-stay-bent",
      "Knees stay bent",
      "Lift both legs off the ground and back toward you until your thighs are approximately vertical. Keep your knees bent.",
      "knee_L.flex",
      "peak",
      70,
      140,
    ),
    checkAnchorTravel(
      "knees-rise",
      "Knees rise as the lower back curls",
      "Lift your buttocks and hip bones up off the floor as you curl up your lower back and drive your knees toward your face.",
      "kneeFront_L",
      "y",
      0.08,
    ),
    checkJointWithinAt(
      "low-back-pressed",
      "Lower back presses into the floor on the way down",
      "Continue tightening your abdominal muscles to press your lower back down into the ground as you lower your legs.",
      "lumbar.flex",
      "start",
      0,
      22,
    ),
  ],
});
