import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Standing facing away from a hip-high pulley, working arm straight at the side, underhand. */
const ACTIVE = {
  "shoulder.elev": 12,
  "shoulder.plane": 28,
  "shoulder.twist": -16,
  "elbow.flex": 6,
  "forearm.pron": -76,
  "clavicle.elev": 2,
};

const REST = {
  "shoulder.elev": 14,
  "shoulder.plane": 40,
  "shoulder.twist": 4,
  "elbow.flex": 70,
  "forearm.pron": 10,
  "wrist.flex": 4,
  "clavicle.elev": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.z": 0.08,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-wrist-curl",
  catalogId: "2e85c6f170d88038ad35d8d47a2b7f51",
  name: "Single Arm Cable Wrist Curl",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 1.3, top: 0.2 },
  station: { kind: "standing", stanceX: 0.15, heelZ: 0.12, balanceZ: 0.16 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.28, 0.95, -0.42],
    columnPos: [0.42, -0.55],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "wrist.flex": -40 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "wrist.flex": 48 }, REST, TRUNK),
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Working wrist curls the handle forward",
      "Curl the wrist and close the hand to pull the handle forward, away from the pulley.",
      "wrist_L.flex",
      50,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Working elbow stays straight",
      "Keep the working arm pinned by your side with a straight elbow.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "underhand",
      "Underhand grip",
      "Grasp the handle with the palm facing forward, away from the pulley.",
      "forearm_L.pron",
      "start",
      -90,
      -45,
    ),
    checkJointWithinAt(
      "knuckles-start-back",
      "The wrist starts extended toward the pulley",
      "Let the cable pull the hand back so the knuckles sit behind the wrist.",
      "wrist_L.flex",
      "top",
      -65,
      -12,
    ),
  ],
});
