import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = POSTURE_HINTS.standing;

const ACTIVE = {
  "shoulder.elev": 14,
  "shoulder.plane": 52,
  "shoulder.twist": -16,
  "forearm.pron": -78,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

/** Empty hand hangs beside the thigh. */
const REST = {
  "shoulder.elev": 8,
  "shoulder.plane": 22,
  "shoulder.twist": 8,
  "elbow.flex": 10,
  "forearm.pron": 12,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-biceps-curl",
  catalogId: "1a15c6f170d88041ba65c740787dc48a",
  name: "Single Arm Dumbbell Biceps Curl",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 6 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "shoulder.elev": 16, "elbow.flex": 136 }, REST, TRUNK),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.045, -0.3, 0.05], 18, "xz")],
  checks: () => [
    checkFlatBack(
      "Pick up a dumbbell and stand upright with approximately a shoulder width stance while holding the dumbbell at your side with an extended elbow.",
    ),
    checkJointWithinAt(
      "elbow-extended",
      "Working elbow starts extended",
      "Stand upright while holding the dumbbell at your side with an extended elbow.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow fully flexes",
      "Curl the dumbbell upward by bending at your elbow.",
      "elbow_L.flex",
      "bottom",
      115,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "After your elbow has fully flexed, reverse the motion until your elbow has returned to an extended position.",
      "elbow_L.flex",
      100,
    ),
    {
      id: "upper-arm-fixed",
      label: "Upper arm stays at the side",
      cue: "Keep your upper arm fixed at your side rather than allowing your upper arm to swing forward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.hypot(elbow.x - shoulder.x - 0.045, elbow.z - shoulder.z - 0.05) * 100;
          },
          5.5,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Direct your palm so that it is facing forward. Maintain this underhand grip on the dumbbell throughout the set.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => deg(angles["forearm_L.pron"]),
          -52,
          "° of forearm pronation",
        ),
    },
  ],
});
