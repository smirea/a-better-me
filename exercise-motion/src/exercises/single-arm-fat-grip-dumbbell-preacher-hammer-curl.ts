import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** One thick handle, thumb up, on the preacher pad. The free hand braces the pad. */
const WORK = {
  "shoulder.elev": 32,
  "shoulder.plane": 70,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

const FREE = {
  "shoulder.elev": 16,
  "shoulder.plane": 28,
  "shoulder.twist": 6,
  "elbow.flex": 28,
  "forearm.pron": 12,
  "wrist.flex": 0,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.55,
  "root.pitch": 4,
  "knee.flex": 72,
};

export const spec = buildExerciseSpec({
  id: "single-arm-fat-grip-dumbbell-preacher-hammer-curl",
  catalogId: "2a95c6f170d88030be42cfe71124d3a1",
  name: "Single Arm Fat Grip Dumbbell Preacher Hammer Curl",
  defaultLoadKg: 6,
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
  apparatus: { kind: "dumbbells", sides: ["L"], fatGrip: true },
  extraContacts: {
    "preacher.armPad": {
      upperarm_L: 0.07,
      forearm_L: 0.05,
      upperarm_R: 0.06,
    },
    "preacher.base": {
      foot_L: 0.09,
      foot_R: 0.09,
      shank_L: 0.06,
      shank_R: 0.06,
    },
  },
  hints: {
    start: sidedHints("L", { ...WORK, "elbow.flex": 16 }, FREE, SEAT),
    end: sidedHints("L", { ...WORK, "elbow.flex": 110 }, FREE, SEAT),
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.18, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.18, 0.02, 0.52), 42),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbow-extended",
      "Working elbow starts extended",
      "Lower the dumbbell until you have fully straightened your elbow.",
      "elbow_L.flex",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbow-flexed",
      "Working elbow fully flexes",
      "Curl the dumbbell upward until the elbow is fully bent, triceps staying on the pad.",
      "elbow_L.flex",
      "bottom",
      70,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Single-arm fat-grip preacher hammer curl",
      "Bend the elbow to curl the dumbbell upward and back toward you.",
      "elbow_L.flex",
      55,
    ),
    {
      id: "neutral-grip",
      label: "Neutral fat-grip held throughout",
      cue: "Hold the dumbbell with the palm facing in toward your side, and do not rotate the palm.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 22, "° away from a neutral forearm"),
    },
    {
      id: "torso-still",
      label: "Torso stays on the seat",
      cue: "While the forearm arcs, the rest of the body should remain stationary.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["hip_L.flex"]) - 88), 18, "° away from a seated hip"),
    },
  ],
});
