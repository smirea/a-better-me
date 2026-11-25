import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Standing lateral-raise machine: arm starts down and sweeps backward into extension. */
const DOWN = {
  "shoulder.elev": 14,
  "shoulder.plane": 28,
  "shoulder.twist": 4,
  "elbow.flex": 10,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const BACK = {
  "shoulder.elev": 42,
  "shoulder.plane": -55,
  "shoulder.twist": -8,
  "elbow.flex": 12,
  "forearm.pron": 68,
  "wrist.flex": 2,
  "clavicle.elev": -4,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "clavicle.elev": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-lateral-raise-machine-shoulder-extension",
  catalogId: "39a5c6f170d88009a9e6ec5460a49747",
  name: "Single Arm Lateral Raise Machine Shoulder Extension",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Extend", "Behind", "Return", "Down"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.25 },
  station: { kind: "standing", stanceX: 0.14, toeOutDeg: 4 },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    sides: ["L"],
    forceDir: [0, 0, 1],
  },
  stiffness: { elbow: 6, shoulder: 0.6, lumbar: 10 },
  hints: {
    start: sidedHints("L", DOWN, REST, POSTURE_HINTS.standing),
    end: sidedHints("L", BACK, REST, POSTURE_HINTS.standing),
  },
  checks: () => [
    checkFlatBack(
      "Keep the legs and torso stationary. Do not let the shoulder tip forward as the arm goes back.",
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the handle with the palm facing backward. The elbow can stay straight or slightly bent.",
      "forearm_L.pron",
      "top",
      45,
      88,
    ),
    checkJointWithinAt(
      "arm-down",
      "Arm starts directed down",
      "Stand upright with the working arm directed down toward the ground.",
      "shoulder_L.elev",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "arm-back",
      "Arm finishes behind the torso",
      "Sweep the arm backward and upward through the shoulder's available range, and pull the shoulder blade back.",
      "shoulder_L.plane",
      "bottom",
      -90,
      -20,
    ),
    checkJointRange(
      "shoulder-extension",
      "Arm travels behind the body",
      "The exercise gets harder as the arm moves further back. Control the return to the stack.",
      "shoulder_L.plane",
      30,
    ),
  ],
});
