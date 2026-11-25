import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

/**
 * Scott curl uses a steeper arm support than a classic preacher. The library
 * preacher pad is the supported surface; the working upper arm sits high on it.
 */
const TRUNK = { ...POSTURE_HINTS.seated, "root.y": 0.55, "root.pitch": 8, "knee.flex": 78 };

const ACTIVE = {
  "shoulder.elev": 64,
  "shoulder.plane": 92,
  "shoulder.twist": 4,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 6,
  "clavicle.prot": 6,
};

const REST = {
  "shoulder.elev": 16,
  "shoulder.plane": 24,
  "shoulder.twist": 6,
  "elbow.flex": 18,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-scott-curl",
  catalogId: "2a55c6f170d88077895ddf5fadda700f",
  name: "Dumbbell Scott Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Extend"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    stanceX: 0.18,
    heelZ: 0.42,
    feetMode: "hanging",
    lockHipFlexDeg: 96,
    frame: { type: "preacher", padTopY: 0.98, padTopZ: 0.2 },
  },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  stiffness: { elbow: 8, forearm: 4 },
  extraContacts: {
    "preacher.armPad": {
      upperarm_L: 0.08,
      upperarm_R: 0.08,
      forearm_L: 0.05,
      forearm_R: 0.06,
      hand_R: 0.07,
    },
    "preacher.base": {
      foot_L: 0.09,
      foot_R: 0.09,
      shank_L: 0.06,
      shank_R: 0.06,
    },
  },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 14 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "elbow.flex": 132 }, REST, TRUNK),
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.18, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.18, 0.02, 0.52), 42),
  ],
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "elbow_L.flex", 120, 220)],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbow-extended",
      "Working elbow starts extended",
      "Lower the dumbbell until you have fully straightened your elbow, with your upper arm on the pad.",
      "elbow_L.flex",
      "top",
      0,
      32,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow flexes at the peak",
      "Curl the dumbbell upward until your elbow is fully bent and your forearm meets your biceps.",
      "elbow_L.flex",
      "bottom",
      70,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Scott curl",
      "While keeping your elbow and triceps against the pad, curl the dumbbell by bending your elbow.",
      "elbow_L.flex",
      60,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Direct your palm forward and keep that underhand grip. Do not rotate the dumbbell.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -48, "° of forearm pronation"),
    },
    {
      id: "upper-arm-on-pad",
      label: "Upper arm stays on the pad",
      cue: "Keep your elbow and triceps snugly against the pad while the rest of your body stays still.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => {
          const s0 = deg(context.angles[context.top]["shoulder_L.elev"]);
          return Math.abs(deg(angles["shoulder_L.elev"]) - s0);
        }, 14, "° of upper-arm drift"),
    },
  ],
});
