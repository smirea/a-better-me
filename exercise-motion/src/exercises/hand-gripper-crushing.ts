import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Elbow bent, palm in, gripper in the working hand. The wrist cocks back as the squeeze finishes. */
const ARM = {
  "shoulder.elev": 18,
  "shoulder.plane": 42,
  "shoulder.twist": -8,
  "elbow.flex": 92,
  "forearm.pron": 8,
  "clavicle.elev": 2,
};

const REST = {
  "shoulder.elev": 10,
  "shoulder.plane": 22,
  "shoulder.twist": 6,
  "elbow.flex": 12,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 0,
};

const OPEN = { ...ARM, "wrist.flex": -16 };
const CRUSH = { ...ARM, "wrist.flex": 22 };

export const spec = buildExerciseSpec({
  id: "hand-gripper-crushing",
  catalogId: "1a15c6f170d8809a878dd1577bac5536",
  name: "Hand Gripper Crushing",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Crush", "Close", "Open", "Reset"],
  tempo: { lower: 0.9, bottom: 0.25, raise: 1.1, top: 0.2 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", sides: ["L"], fatGrip: true },
  hints: {
    start: sidedHints("L", OPEN, REST, POSTURE_HINTS.standing),
    end: sidedHints("L", CRUSH, REST, POSTURE_HINTS.standing),
  },
  checks: () => [
    checkJointRange(
      "crush",
      "The wrist and hand close on the gripper",
      "Squeeze the handles together. The wrist may cock as the fingers crush.",
      "wrist_L.flex",
      24,
    ),
    checkJointWithinAt(
      "elbow-bent",
      "Working elbow stays bent",
      "Hold the gripper with the elbow bent about 90 degrees and the upper arm by your side.",
      "elbow_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "free-arm-down",
      "Free arm stays clear",
      "The non-working hand stays off the gripper once the set begins.",
      "elbow_R.flex",
      "start",
      0,
      30,
    ),
    checkJointWithinAt(
      "palm-in",
      "Palm faces inward",
      "Set the gripper with the thumb forward and the palm facing in.",
      "forearm_L.pron",
      "peak",
      -25,
      35,
    ),
  ],
});
