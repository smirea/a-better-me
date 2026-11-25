import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove } from "../solver";

const ARMS = {
  "shoulder.elev": 14,
  "shoulder.plane": 72,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 50,
  "wrist.flex": 0,
};

/** Heels just off the mat, knees straight, low back already pressed flat. */
const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 12,
  "thoracic.flex": 4,
  "neck.flex": 4,
  "hip.flex": 12,
  "hip.abd": 8,
  "knee.flex": 6,
  "ankle.dorsi": -8,
  ...ARMS,
};

/** Legs near vertical. Hip bones stay down — this is not a reverse crunch. */
const UP = {
  ...DOWN,
  "hip.flex": 92,
  "knee.flex": 8,
  "ankle.dorsi": 4,
  "lumbar.flex": 14,
};

export const spec = buildExerciseSpec({
  id: "double-straight-leg-raise",
  catalogId: "1f55c6f170d880118a5ec54126ffadf2",
  name: "Double Straight Leg Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lower", "Lift", "Vertical", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "shoulder", "elbow", "neck", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 14, hip: 4, knee: 8 },
  extraGoals: (body) => [keepAbove(body, "heel_L", 0.03, 40), keepAbove(body, "heel_R", 0.03, 40)],
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "legs-lift",
      "Straight legs lift toward vertical",
      "While keeping your knees straight, lift both legs off the ground through your available range of motion, as close to vertical as your flexibility allows.",
      "hip_L.flex",
      55,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep your knees straight while you lift and lower both legs.",
      "knee_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "hips-stay-down",
      "Hip bones stay on the ground",
      "Keep the backside of your hip bones in contact with the ground throughout this variation, in contrast to a reverse crunch.",
      "lumbar.flex",
      "peak",
      0,
      24,
    ),
    checkAnchorTravel(
      "heels-rise",
      "Heels rise as the legs lift",
      "Lift both legs off the ground, then lower them until the back of your heels lightly contacts the ground.",
      "heel_L",
      "y",
      0.35,
    ),
  ],
});
