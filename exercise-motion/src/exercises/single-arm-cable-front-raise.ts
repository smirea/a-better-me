import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Working arm starts pulled behind the torso; the free arm hangs. */
const ACTIVE_DOWN = {
  "shoulder.elev": 32,
  "shoulder.plane": -38,
  "shoulder.twist": 18,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 6,
};

const ACTIVE_UP = {
  ...ACTIVE_DOWN,
  "shoulder.elev": 90,
  "shoulder.plane": 84,
  "forearm.pron": 68,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 18,
  "elbow.flex": 8,
  "forearm.pron": 12,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 12,
  "hip.flex": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-front-raise",
  catalogId: "21c5c6f170d880019593eeff6244ee38",
  name: "Single Arm Cable Front Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Behind torso"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    split: { frontSide: "R", frontZ: 0.18, rearZ: -0.16, rearMode: "flat" },
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.42, 0.9, 0],
    columnPos: [0.55, -0.28],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 6, shoulder: 0.65, lumbar: 8 },
  hints: {
    start: sidedHints("L", ACTIVE_DOWN, REST, TRUNK),
    end: sidedHints("L", ACTIVE_UP, REST, TRUNK),
  },
  checks: () => [
    checkFlatBack(
      "While your arm moves from motion at your shoulder, the rest of your body should remain stationary.",
    ),
    checkJointWithinAt(
      "behind-torso",
      "Arm starts behind the torso",
      "Walk forward until the cable pulls your arm backward behind your torso through a range your shoulder mobility permits.",
      "shoulder_L.plane",
      "start",
      -70,
      -12,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "While keeping your elbow straight, sweep your arm forward and upward.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "shoulder-height",
      "Arm finishes parallel to the ground",
      "Sweep your arm until it is approximately parallel to the ground, outstretched in front of you, palm facing down.",
      "shoulder_L.elev",
      "peak",
      70,
      115,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulder flexes from behind the torso",
      "Think about the side of your shoulder being the center of a clock, and your arm the hand that rotates about this point.",
      "shoulder_L.elev",
      40,
    ),
  ],
});
