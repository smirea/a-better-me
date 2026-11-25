import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Right side down, both knees straight, band around the ankles, top leg lifts in the frontal plane. */
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
  "hip_R.abd": 24,
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
  id: "side-lying-banded-hip-abduction-leg-raise",
  catalogId: "1df5c6f170d880cf8f73c5df28bf5a2e",
  name: "Side-Lying Banded Hip Abduction Leg Raise",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lift", "Up", "Lower", "Together"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 1.3, top: 0.25 },
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
  apparatus: {
    kind: "band",
    anchors: [
      [0.62, 0.95, 0.02],
      [0.62, 0.95, -0.02],
    ],
    targetAnchors: ["ankleCuff_L", "ankleCuff_R"],
  },
  stiffness: { hip: 4, knee: 10, lumbar: 8 },
  hints: {
    start: sidedHints("L", { "hip.abd": 8 }, {}, LYING),
    end: sidedHints("L", { "hip.abd": 40 }, {}, LYING),
  },
  checks: () => [
    checkJointWithinAt(
      "knee-straight",
      "Top knee stays straight",
      "Lift the top leg with the knee straight and the thigh in line with the torso.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "no-hip-flex",
      "Top thigh stays in line",
      "Lift the leg straight up rather than bringing it forward toward the chest.",
      "hip_L.flex",
      "peak",
      -8,
      18,
    ),
    checkJointRange(
      "abduction",
      "Top leg abducts",
      "Raise the top leg through the hip’s available range, then lower until the band slackens or the feet meet.",
      "hip_L.abd",
      18,
    ),
  ],
});
