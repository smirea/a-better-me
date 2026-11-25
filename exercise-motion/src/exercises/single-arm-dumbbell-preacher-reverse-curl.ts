import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Working arm stays reverse-grip on the pad. The free hand braces the pad. */
const WORK = {
  "shoulder.elev": 16,
  "shoulder.plane": 68,
  "shoulder.twist": -8,
  "forearm.pron": 78,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

const FREE = {
  "shoulder.elev": 12,
  "shoulder.plane": 18,
  "shoulder.twist": 6,
  "elbow.flex": 14,
  "forearm.pron": 10,
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
  id: "single-arm-dumbbell-preacher-reverse-curl",
  catalogId: "29f5c6f170d88040aad8d692c069b2f1",
  name: "Single Arm Dumbbell Preacher Reverse Curl",
  defaultLoadKg: 4,
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
    end: sidedHints("L", { ...WORK, "elbow.flex": 108 }, FREE, SEAT),
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
      "Single-arm preacher reverse curl",
      "Bend the elbow to curl the dumbbell upward and back toward you.",
      "elbow_L.flex",
      55,
    ),
    {
      id: "reverse-grip",
      label: "Reverse grip held throughout",
      cue: "Hold the dumbbell with the palm facing backward in a reverse grip, and do not rotate the palm.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -55, "° short of a reverse grip"),
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
