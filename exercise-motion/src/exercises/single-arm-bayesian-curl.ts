import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Facing away from a hip-height pulley so the straight arm is pulled behind the torso. */
const BACK = {
  "shoulder.elev": 42,
  "shoulder.plane": -58,
  "shoulder.twist": -18,
  "forearm.pron": -74,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -8,
};

const CURL = {
  ...BACK,
  "elbow.flex": 128,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 36,
  "elbow.flex": 12,
  "forearm.pron": 8,
  "clavicle.elev": 2,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 8,
  "hip.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "single-arm-bayesian-curl",
  catalogId: "1a15c6f170d88027bdddc238baa28936",
  name: "Single Arm Bayesian Curl",
  defaultLoadKg: 2,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: {
    kind: "standing",
    stanceX: 0.22,
    toeOutDeg: 8,
    balanceZ: false,
    split: { frontSide: "R", frontZ: 0.24, rearZ: -0.22, rearMode: "flat" },
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.22, 0.95, -0.72],
    columnPos: [0.28, -0.95],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 5, shoulder: 2.6, lumbar: 9 },
  hints: {
    start: sidedHints("L", { ...BACK, "elbow.flex": 8 }, REST, STANCE),
    end: sidedHints("L", CURL, REST, STANCE),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.1, -0.22, -0.16], 18, "xz")],
  checks: () => [
    checkFlatBack(
      "Stand upright while gripping the handle and keep your upper arm fixed behind the torso.",
    ),
    checkJointWithinAt(
      "arm-behind",
      "Upper arm stays behind the torso",
      "Allow the cable’s resistance to pull your upper arm backward at an angle behind your torso.",
      "shoulder_L.plane",
      "peak",
      -90,
      -30,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow starts extended",
      "Step forward while keeping your elbow fully extended.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Elbow fully flexes at the peak",
      "After your elbow has fully flexed, reverse the motion by lowering the handle.",
      "elbow_L.flex",
      "bottom",
      108,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the handle upward by bending at your elbow.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "underhand",
      label: "Underhand grip",
      cue: "Grasp the handle with an underhand grip such that your palm is directed forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -42, "° of forearm pronation"),
    },
  ],
});
