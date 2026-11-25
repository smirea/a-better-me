import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { pin } from "../solver";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** One lever of a standing multi-flight, swept forward to shoulder height. */
const ACTIVE_DOWN = {
  "shoulder.elev": 14,
  "shoulder.plane": 70,
  "shoulder.twist": 12,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const ACTIVE_UP = {
  ...ACTIVE_DOWN,
  "shoulder.elev": 92,
  "shoulder.plane": 86,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "wrist.flex": 0,
  "clavicle.elev": 0,
};

export const spec = buildExerciseSpec({
  id: "lateral-raise-machine-front-raise",
  catalogId: "3895c6f170d88080b166f879970d462b",
  name: "Lateral Raise Machine Front Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Down"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 4 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    sides: ["L"],
    forceDir: [0, -1, 0.05],
  },
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0, 0.85, 0.04), 36, "x")],
  stiffness: { elbow: 5, shoulder: 0.7, lumbar: 8 },
  hints: {
    start: sidedHints("L", ACTIVE_DOWN, REST, POSTURE_HINTS.standing),
    end: sidedHints("L", ACTIVE_UP, REST, POSTURE_HINTS.standing),
  },
  checks: () => [
    checkFlatBack(
      "All the movement should occur from shoulder motion while you keep your legs and torso stationary throughout the exercise.",
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Firmly grasp the handle with your palm facing backward.",
      "forearm_L.pron",
      "start",
      45,
      86,
    ),
    checkJointWithinAt(
      "arm-down",
      "Arm starts directed down",
      "In the starting position, you should be standing upright with your arm directed down toward the ground.",
      "shoulder_L.elev",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Handle finishes near shoulder height",
      "Finish with the arm outstretched straight in front of you, approximately parallel to the ground.",
      "shoulder_L.elev",
      "peak",
      70,
      120,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulder flexes through the raise",
      "Sweep your arm forward and upward in an arcing manner to lift the handle near shoulder height.",
      "shoulder_L.elev",
      50,
    ),
  ],
});
