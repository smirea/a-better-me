import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

const TRUNK = { ...POSTURE_HINTS.seated, "root.y": 0.55, "root.pitch": 6, "knee.flex": 72 };

const ACTIVE = {
  "shoulder.elev": 58,
  "shoulder.plane": 88,
  "shoulder.twist": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
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
  id: "single-arm-dumbbell-preacher-hammer-curl",
  catalogId: "29d5c6f170d880c18b4adece92b557f5",
  name: "Single Arm Dumbbell Preacher Hammer Curl",
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
    lockHipFlexDeg: 92,
    frame: { type: "preacher", padTopY: 0.96, padTopZ: 0.22 },
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
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 16 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "elbow.flex": 118 }, REST, TRUNK),
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.18, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.18, 0.02, 0.52), 42),
  ],
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "elbow_L.flex", 118, 220)],
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
      "Curl the dumbbell upward until your elbow is fully bent.",
      "elbow_L.flex",
      "bottom",
      70,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Single-arm preacher hammer curl",
      "While keeping your elbow and triceps on the arm pad, curl the dumbbell by bending your elbow.",
      "elbow_L.flex",
      55,
    ),
    {
      id: "neutral-grip",
      label: "Neutral grip held throughout",
      cue: "Hold the dumbbell with your palm facing in toward your side, and keep that hammer grip for the whole set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 22, "° away from a neutral forearm"),
    },
    {
      id: "upper-arm-on-pad",
      label: "Working upper arm stays on the pad",
      cue: "Keep your elbow and triceps snugly against the arm pad while the rest of your body stays still.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => {
          const s0 = deg(context.angles[context.top]["shoulder_L.elev"]);
          return Math.abs(deg(angles["shoulder_L.elev"]) - s0);
        }, 14, "° of upper-arm drift"),
    },
  ],
});
