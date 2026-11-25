import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { plantToe } from "../solver";

/** Left knee down (working side), right foot forward. High cable, elbow tucked. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.74,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 0,
  "hip_R.flex": 92,
  "hip_R.abd": 2,
  "hip_R.rot": 4,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 28,
  "hip_L.abd": 2,
  "knee_L.flex": 100,
  "ankle_L.dorsi": 25,
};

const ACTIVE_UP = {
  "shoulder.elev": 150,
  "shoulder.plane": 74,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 6,
};

const ACTIVE_DOWN = {
  "shoulder.elev": 32,
  "shoulder.plane": 20,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 0,
  "wrist.flex": 4,
  "clavicle.elev": -4,
  "clavicle.prot": -14,
};

const REST = {
  "shoulder.elev": 18,
  "shoulder.plane": 24,
  "elbow.flex": 16,
  "forearm.pron": 12,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "half-kneeling-single-arm-cable-lat-pulldown",
  catalogId: "1a15c6f170d8804280dbcaba5f75cf49",
  name: "Half-Kneeling Single Arm Cable Lat Pulldown",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Chest", "Return", "Reach"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 2 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.12, 2.12, 0.72],
    columnPos: [0.12, 0.86],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", ACTIVE_UP, REST, LEGS),
    end: sidedHints("L", ACTIVE_DOWN, REST, LEGS),
  },
  extraGoals: (body) => plantToe(body, "L", new Vector3(0.14, 0.08, -0.56), 0, 110),
  checks: () => [
    checkJointRange(
      "elbow-pull",
      "Working elbow bends down and back",
      "Drive your elbow downward and then backward while bending it to pull the handle toward the side of your upper chest.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "arm-up",
      "Arm starts aligned with the high cable",
      "Start with a straight elbow and your whole arm elevated in line with the cable.",
      "shoulder_L.elev",
      "top",
      120,
      175,
    ),
    checkJointWithinAt(
      "elbow-in",
      "Elbow stays in front of the torso",
      "When the upper arm is about parallel with the ground, the back of the elbow points forward rather than flaring out.",
      "shoulder_L.plane",
      "bottom",
      6,
      48,
    ),
    checkJointWithinAt(
      "down-knee",
      "Working-side knee stays down",
      "The knee on the side holding the cable rests on the ground in the half-kneeling stance.",
      "knee_L.flex",
      "bottom",
      80,
      130,
    ),
    checkJointWithinAt(
      "front-knee",
      "Front knee stays bent",
      "The opposite foot is forward, with that knee bent, and the torso stays upright.",
      "knee_R.flex",
      "bottom",
      60,
      120,
    ),
    checkJointWithinAt(
      "scapula-down",
      "Shoulder blade pulls down",
      "Simultaneously pull your shoulder blade down away from your ear.",
      "clavicle_L.elev",
      "bottom",
      -18,
      6,
    ),
  ],
});
