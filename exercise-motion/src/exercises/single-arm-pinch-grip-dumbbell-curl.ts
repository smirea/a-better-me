import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** One hand pinches the dumbbell head. The free arm hangs. */
const WORK = {
  "shoulder.plane": 42,
  "shoulder.twist": 20,
  "forearm.pron": 76,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const FREE = {
  "shoulder.elev": 8,
  "shoulder.plane": 20,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 10,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-pinch-grip-dumbbell-curl",
  catalogId: "2ab5c6f170d880ab86d3fc93d8eaa4d3",
  name: "Single Arm Pinch Grip Dumbbell Curl",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  hints: {
    start: sidedHints("L", { ...WORK, "shoulder.elev": 12, "elbow.flex": 8, "wrist.flex": -8 }, FREE, POSTURE_HINTS.standing),
    end: sidedHints("L", { ...WORK, "shoulder.elev": 16, "elbow.flex": 130, "wrist.flex": -42 }, FREE, POSTURE_HINTS.standing),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.06, -0.3, 0.06], 16, "xz")],
  checks: () => [
    checkFlatBack("Stand upright in a near hip-width stance with the working arm by your side and the elbow straight."),
    checkJointWithinAt(
      "elbow-extended",
      "Working elbow starts extended",
      "Stand upright with your arm by your side and your elbow straight.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow fully flexes",
      "Curl the dumbbell until the elbow is fully bent and the handle angles upward with the forearm.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Single-arm pinch-grip curl",
      "Curl the dumbbell upward by bending the elbow, then lower it until the elbow is straight.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "pronated-pinch",
      label: "Palm stays down in a pinch",
      cue: "Grasp the top end of the dumbbell with the palm directed down, and keep squeezing.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -50, "° short of a palm-down pinch"),
    },
    checkJointWithinAt(
      "wrist-cocked",
      "Wrist extends to keep the handle with the forearm",
      "When the elbow is bent, cock the wrist back so the handle points with the forearm instead of hanging vertical.",
      "wrist_L.flex",
      "bottom",
      -65,
      -20,
    ),
  ],
});
