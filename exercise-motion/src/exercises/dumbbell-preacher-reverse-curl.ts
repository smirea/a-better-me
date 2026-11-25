import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

/** Overhand dumbbells, upper arms on the preacher pad, wrists straight. */
const ARMS = {
  "shoulder.elev": 40,
  "shoulder.plane": 64,
  "shoulder.twist": 8,
  "forearm.pron": 78,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.55,
  "root.pitch": 4,
  "knee.flex": 72,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-preacher-reverse-curl",
  catalogId: "29f5c6f170d880ccaecefc37ee71e532",
  name: "Dumbbell Preacher Reverse Curl",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Extend"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    stanceX: 0.24,
    heelZ: 0.42,
    feetMode: "hanging",
    lockHipFlexDeg: 92,
    frame: { type: "preacher", padTopY: 0.96, padTopZ: 0.22 },
  },
  apparatus: { kind: "dumbbells" },
  extraContacts: {
    "preacher.armPad": {
      upperarm_L: 0.07,
      upperarm_R: 0.07,
      forearm_L: 0.08,
      forearm_R: 0.08,
    },
    "preacher.base": {
      foot_L: 0.09,
      foot_R: 0.09,
      shank_L: 0.06,
      shank_R: 0.06,
    },
  },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 16 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 92 },
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.22, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.22, 0.02, 0.52), 42),
    pin(body, "elbowTip_L", () => new Vector3(0.26, 0, 0), 80, "x"),
    pin(body, "elbowTip_R", () => new Vector3(-0.26, 0, 0), 80, "x"),
  ],
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "elbow_L.flex", 18, 28), lockAngle(body, "elbow_R.flex", 18, 28)],
    end: [lockAngle(body, "elbow_L.flex", 96, 28), lockAngle(body, "elbow_R.flex", 96, 28)],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Lower the dumbbells until you have fully straightened your elbows.",
      "elbow_L.flex",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the dumbbells upward until your elbows are fully bent, upper arms staying on the pad.",
      "elbow_L.flex",
      "bottom",
      70,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Preacher reverse curl",
      "Bend the elbows to curl the dumbbells upward and back toward you.",
      "elbow_L.flex",
      55,
    ),
    {
      id: "reverse-grip",
      label: "Reverse grip held throughout",
      cue: "Hold the dumbbells with palms facing backward in an overhand reverse grip, and do not rotate the palms.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -55, "° short of a reverse grip"),
    },
    {
      id: "torso-still",
      label: "Torso stays on the seat",
      cue: "While your forearms arc, the rest of your body should remain stationary.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["hip_L.flex"]) - 88), 18, "° away from a seated hip"),
    },
  ],
});
