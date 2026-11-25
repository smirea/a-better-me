import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantToe } from "../solver";

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
  "hip_L.flex": 36,
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

const HIGH = {
  ...ARMS,
  "shoulder.elev": 118,
  "shoulder.plane": 64,
  "lumbar.flex": -6,
  "thoracic.flex": -6,
  "lumbar.twist": -8,
  "thoracic.twist": -28,
};

const LOW = {
  ...ARMS,
  "shoulder.elev": 42,
  "shoulder.plane": 70,
  "lumbar.flex": 16,
  "thoracic.flex": 22,
  "lumbar.twist": 8,
  "thoracic.twist": 28,
};

export const spec = buildExerciseSpec({
  id: "high-to-low-cable-chop",
  catalogId: "1a45c6f170d88052a427c7804e342721",
  name: "High-To-Low Cable Chop",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Chop", "Low", "Return", "High"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 1.6, top: 0.25 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 0 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.78, 1.62, 0.08],
    columnPos: [1.0, -0.02],
    facingDir: -1,
    attachment: "rope",
    twoHandsOnOne: true,
  },
  extraGoals: (body) => [
    ...plantToe(body, "L", new Vector3(0.14, 0.08, -0.56), 0, 110),
    lockAngle(body, "hip_L.flex", 40, 20),
    lockAngle(body, "hip_R.flex", 90, 16),
  ],
  stiffness: { elbow: 8, lumbar: 5, thoracic: 4, knee: 6 },
  hints: {
    start: sidedHints("L", HIGH, HIGH, LEGS),
    end: sidedHints("L", LOW, LOW, LEGS),
  },
  checks: () => [
    checkJointRange(
      "trunk-rotation",
      "Chest rotates from high to low",
      "Turn the chest diagonally down and away from the high cable, then back up toward the station.",
      "thoracic.twist",
      36,
    ),
    checkJointRange(
      "arms-sweep",
      "Hands sweep from high to low",
      "The rope stays in front of the chest and travels diagonally down and away from the pulley.",
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
    checkJointRange(
      "trunk-flexion",
      "Trunk flexes as the chop drops",
      "The downward chop also flexes the trunk a little as the chest turns away from the cable.",
      "thoracic.flex",
      6,
    ),
  ],
});
