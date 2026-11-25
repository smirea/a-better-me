import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { plantToe } from "../solver";

/** Half kneel, low cable on the down-knee side. Arms stay straight in front of the chest. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.72,
  "root.pitch": 2,
  "neck.flex": 2,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
  "hip_R.flex": 92,
  "hip_R.abd": 4,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 18,
  "hip_L.abd": 4,
  "knee_L.flex": 100,
  "ankle_L.dorsi": 28,
};

const ARMS = {
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 55,
  "wrist.flex": 0,
};

const DOWN = {
  ...ARMS,
  "shoulder.elev": 48,
  "shoulder.plane": 68,
  "lumbar.flex": 8,
  "thoracic.flex": 10,
  "lumbar.twist": -8,
  "thoracic.twist": -28,
};

const UP = {
  ...ARMS,
  "shoulder.elev": 112,
  "shoulder.plane": 62,
  "lumbar.flex": -4,
  "thoracic.flex": -8,
  "lumbar.twist": 8,
  "thoracic.twist": 28,
};

export const spec = buildExerciseSpec({
  id: "low-to-high-cable-chop",
  catalogId: "1a45c6f170d8809bb4c5e70bc31ea462",
  name: "Low-To-High Cable Chop",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Chop", "High", "Return", "Low"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 1.6, top: 0.25 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 0 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.82, 0.28, 0.2],
    columnPos: [1.02, 0.08],
    facingDir: -1,
    attachment: "rope",
    twoHandsOnOne: true,
  },
  extraGoals: (body) => [...plantToe(body, "L", new Vector3(0.14, 0.08, -0.56), 0, 110)],
  stiffness: { elbow: 8, lumbar: 5, thoracic: 4, knee: 6 },
  hints: {
    start: sidedHints("L", DOWN, DOWN, LEGS),
    end: sidedHints("L", UP, UP, LEGS),
  },
  checks: () => [
    checkJointRange(
      "trunk-rotation",
      "Chest rotates from low to high",
      "Turn the chest diagonally up and away from the low cable, then back down toward the station.",
      "thoracic.twist",
      36,
    ),
    checkJointRange(
      "arms-sweep",
      "Hands sweep from low to high",
      "The rope stays in front of the chest and travels diagonally up and away from the pulley.",
      "shoulder_L.elev",
      40,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight. The arms link the rope to the torso rather than pulling.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "down-knee",
      "Inside knee stays down",
      "The knee closer to the cable stays on the ground while the belt buckle faces forward.",
      "knee_L.flex",
      "bottom",
      75,
      125,
    ),
  ],
});
