import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Standing multi-flight used as a straight-arm pulldown. The catalog's "arm directed
 * down" line matches the shoulder-extension variation; this one rotates the handle
 * as high as the machine allows and pulls it to the thigh.
 */
const UP = {
  "shoulder.elev": 155,
  "shoulder.plane": 72,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 14,
  "clavicle.prot": 2,
};

const DOWN = {
  "shoulder.elev": 16,
  "shoulder.plane": 58,
  "shoulder.twist": 4,
  "elbow.flex": 12,
  "forearm.pron": 68,
  "wrist.flex": 2,
  "clavicle.elev": -6,
  "clavicle.prot": -6,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "clavicle.elev": 0,
};

export const spec = buildExerciseSpec({
  id: "multi-flight-machine-pullover",
  catalogId: "39a5c6f170d88075895df332b966b775",
  name: "Multi Flight Machine Pullover",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Pull", "Thigh", "Return", "High"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 4 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    sides: ["L"],
    forceDir: [0, 1, 0.05],
  },
  stiffness: { elbow: 6, shoulder: 0.55, lumbar: 10 },
  hints: {
    start: sidedHints("L", UP, REST, POSTURE_HINTS.standing),
    end: sidedHints("L", DOWN, REST, POSTURE_HINTS.standing),
  },
  checks: () => [
    checkFlatBack(
      "All the movement comes from the shoulder. Keep the legs and torso still, chest proud, shoulders level with the pivot.",
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the high handle with the palm facing backward. A slight elbow bend may stay for the set.",
      "forearm_L.pron",
      "top",
      45,
      88,
    ),
    checkJointWithinAt(
      "arm-high",
      "Arm starts up with the handle",
      "Rotate the handle as high as the machine allows before the first pull.",
      "shoulder_L.elev",
      "top",
      125,
      175,
    ),
    checkJointWithinAt(
      "by-thigh",
      "Handle finishes by the thigh",
      "Sweep the arm down and back until the handle is right by the thigh.",
      "shoulder_L.elev",
      "bottom",
      0,
      40,
    ),
    checkJointRange(
      "straight-arm-pulldown",
      "Straight arm arcs from overhead to the thigh",
      "Control the return until the selected plates lightly meet the stack.",
      "shoulder_L.elev",
      90,
    ),
  ],
});
