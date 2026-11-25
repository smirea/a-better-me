import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove } from "../solver";

/** Arms hover just off the floor, pointing toward the feet, and stay there. */
const ARMS = {
  "shoulder.elev": 22,
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 55,
  "wrist.flex": 0,
};

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 6,
  "hip.abd": 4,
  "knee.flex": 4,
  "ankle.dorsi": -6,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.15,
  "root.pitch": -74,
  "lumbar.flex": 28,
  "thoracic.flex": 30,
  "neck.flex": 10,
};

export const spec = buildExerciseSpec({
  id: "corpse-crunch",
  catalogId: "2aa5c6f170d880a08b6fc14959d2a8ad",
  name: "Corpse Crunch",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Curl", "Crunch", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["hip", "knee", "ankle", "elbow", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 18, thoracic: 16, hip: 10, shoulder: 4 },
  extraGoals: (body) => [
    keepAbove(body, "grip_L", 0.05, 50),
    keepAbove(body, "grip_R", 0.05, 50),
    keepAbove(body, "heel_L", 0.06, 70),
    keepAbove(body, "heel_R", 0.06, 70),
    keepAbove(body, "ballIn_L", 0.04, 50),
    keepAbove(body, "ballIn_R", 0.04, 50),
  ],
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "back-curls",
      "The back rounds to lift the shoulders",
      "Curl your back to lift it off the ground while keeping the backs of your hip bones and legs on the ground. Drive the bottom of your ribs toward the top of your hip bones.",
      "thoracic.flex",
      14,
    ),
    checkJointRange(
      "low-back-curls",
      "The lower back curls with the crunch",
      "To train your abdominal muscles dynamically, your back should progressively round rather than remain flat.",
      "lumbar.flex",
      12,
    ),
    checkJointWithinAt(
      "hips-stay",
      "Hips do not flex",
      "In contrast to a sit-up, your shoulders should remain clearly behind your hips. Move through the back without hip motion.",
      "hip_L.flex",
      "peak",
      -6,
      20,
    ),
    checkJointWithinAt(
      "legs-straight",
      "Legs stay straight on the floor",
      "Lie down with your knees straight out in front of you and keep the legs down.",
      "knee_L.flex",
      "peak",
      -8,
      22,
    ),
    checkNeutralNeck(
      "You can keep your neck near a neutral position like you would normally do when standing upright.",
      24,
    ),
  ],
});
