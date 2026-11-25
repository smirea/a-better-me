import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { plantToe } from "../solver";

/** Half-kneeling, cable to the working side. Arm starts in half a Y and finishes with the elbow flared (half a T). Palm faces forward. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.74,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 0,
  "hip_R.flex": 92,
  "hip_R.abd": 4,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 30,
  "hip_L.abd": 6,
  "knee_L.flex": 100,
  "ankle_L.dorsi": 25,
};

const ACTIVE_UP = {
  "shoulder.elev": 140,
  "shoulder.plane": 18,
  "shoulder.twist": 16,
  "elbow.flex": 8,
  "forearm.pron": 72,
  "wrist.flex": 0,
  "clavicle.elev": 14,
  "clavicle.prot": -6,
};

const ACTIVE_DOWN = {
  "shoulder.elev": 68,
  "shoulder.plane": 4,
  "shoulder.twist": 14,
  "elbow.flex": 92,
  "forearm.pron": 68,
  "wrist.flex": 2,
  "clavicle.elev": -2,
  "clavicle.prot": -8,
};

const REST = {
  "shoulder.elev": 16,
  "shoulder.plane": 30,
  "elbow.flex": 18,
  "forearm.pron": 20,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-lat-pull-in",
  catalogId: "1a15c6f170d88069a1d3eb2d608c87b0",
  name: "Single Arm Cable Lat Pull-In",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Side", "Return", "Reach"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 2 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.78, 2.1, 0.28],
    columnPos: [0.9, 0.4],
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
      "Elbow bends as the arm pulls in",
      "Drive your elbow downward and in toward your side, progressively bending it to pull the handle closer to your torso.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arm-y",
      "Arm starts out in half a Y",
      "Start with the arm elevated out to your side, aligned with the cable, forming half of a Y with your torso.",
      "shoulder_L.elev",
      "top",
      110,
      170,
    ),
    checkJointWithinAt(
      "elbow-out",
      "Elbow flares out to the side",
      "When the upper arm is about parallel with the ground, the back of the elbow points out toward the cable, forming half of a T.",
      "shoulder_L.plane",
      "bottom",
      -20,
      28,
    ),
    checkJointWithinAt(
      "palm-forward",
      "Palm faces the same way as the chest",
      "Direct your palm forward, the same direction your chest is facing.",
      "forearm_L.pron",
      "top",
      40,
      100,
    ),
    checkJointWithinAt(
      "down-knee",
      "Working-side knee stays down",
      "The knee on the side holding the cable rests on the ground.",
      "knee_L.flex",
      "bottom",
      80,
      130,
    ),
  ],
});
