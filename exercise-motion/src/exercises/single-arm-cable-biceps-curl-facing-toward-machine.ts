import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low pulley in front of the working hand. Upper arm sits slightly ahead of the ribs. */
const ARM = {
  "shoulder.elev": 26,
  "shoulder.plane": 72,
  "shoulder.twist": -16,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 30,
  "elbow.flex": 14,
  "forearm.pron": 10,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-biceps-curl-facing-toward-machine",
  catalogId: "1a15c6f170d8804c9235c935d487bda8",
  name: "Single Arm Cable Biceps Curl (Facing Toward Machine)",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.26, heelZ: -0.06, toeOutDeg: 8, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.2, 0.28, 0.92],
    columnPos: [0.22, 1.08],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 5, shoulder: 2.4, lumbar: 9 },
  hints: {
    start: sidedHints("L", { ...ARM, "elbow.flex": 8 }, REST, POSTURE_HINTS.standing),
    end: sidedHints("L", { ...ARM, "elbow.flex": 132 }, REST, POSTURE_HINTS.standing),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.06, -0.27, 0.1], 16, "xz")],
  checks: () => [
    checkFlatBack(
      "Stand upright while gripping the handle and keep the upper arm fixed in front of the body.",
    ),
    checkJointWithinAt(
      "elbow-extended",
      "Elbow starts extended",
      "While keeping your elbow extended, stand upright while gripping the handle.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Elbow fully flexes at the peak",
      "After your elbow has fully flexed, reverse the motion by lowering the handle.",
      "elbow_L.flex",
      "bottom",
      110,
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
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -45, "° of forearm pronation"),
    },
  ],
});
