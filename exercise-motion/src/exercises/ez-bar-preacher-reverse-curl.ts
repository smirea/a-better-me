import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Semi-overhand EZ grip on the preacher pad. */
const ARMS = {
  "shoulder.elev": 44,
  "shoulder.plane": 84,
  "shoulder.twist": 16,
  "forearm.pron": 48,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "ez-bar-preacher-reverse-curl",
  catalogId: "29f5c6f170d8804180a6c86ed8986df2",
  name: "EZ Bar Preacher Reverse Curl",
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
    start: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 4, "knee.flex": 72, "elbow.flex": 18 },
    end: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 4, "knee.flex": 72, "elbow.flex": 124 },
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
      36,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the bar up until your elbows are fully bent, keeping your upper arms on the pad.",
      "elbow_L.flex",
      "bottom",
      75,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Preacher reverse curl",
      "Curl the bar upward and back toward you by bending at your elbows.",
      "elbow_L.flex",
      50,
    ),
    {
      id: "semi-overhand",
      label: "Semi-overhand grip held throughout",
      cue: "Grasp the EZ bar with your palms angled backward and in toward each other.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -25, "° short of a semi-overhand grip"),
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
