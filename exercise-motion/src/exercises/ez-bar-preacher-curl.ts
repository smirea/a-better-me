import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Shoulder-width semi-underhand grip, upper arms on the preacher pad. */
const ARMS = {
  "shoulder.elev": 44,
  "shoulder.plane": 84,
  "shoulder.twist": -10,
  "forearm.pron": -42,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "ez-bar-preacher-curl",
  catalogId: "1a15c6f170d88040bffdd2f6127e6d4c",
  name: "EZ Bar Preacher Curl",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
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
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.2,
    alignWrists: false,
  },
  extraContacts: {
    "preacher.armPad": {
      upperarm_L: 0.07,
      upperarm_R: 0.07,
      forearm_L: 0.05,
      forearm_R: 0.05,
    },
    "preacher.base": {
      foot_L: 0.09,
      foot_R: 0.09,
      shank_L: 0.06,
      shank_R: 0.06,
    },
  },
  hints: {
    start: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 4, "knee.flex": 72, "elbow.flex": 14 },
    end: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 4, "knee.flex": 72, "elbow.flex": 130 },
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.18, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.18, 0.02, 0.52), 42),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Start with your elbows fully straightened and the bar clear of the bench.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the bar up until your elbows are fully bent, keeping your upper arms on the pad.",
      "elbow_L.flex",
      "bottom",
      60,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Preacher curl",
      "Curl the bar upward and back toward you by bending at your elbows.",
      "elbow_L.flex",
      45,
    ),
    {
      id: "semi-underhand",
      label: "Semi-underhand EZ grip",
      cue: "Grasp the EZ bar with a shoulder-width semi-underhand grip so your palms angle forward and inward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -12, "° of forearm pronation"),
    },
    {
      id: "torso-still",
      label: "Torso stays on the seat",
      cue: "While your forearms move, the rest of your body stays stationary.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["hip_L.flex"]) - 88), 16, "° away from a seated hip"),
    },
  ],
});
