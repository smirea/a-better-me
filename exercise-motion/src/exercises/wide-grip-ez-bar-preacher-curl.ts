import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Wide semi-underhand grip, upper arms on the preacher pad. */
const ARMS = {
  "shoulder.elev": 44,
  "shoulder.plane": 78,
  "shoulder.twist": -8,
  "forearm.pron": -36,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-ez-bar-preacher-curl",
  catalogId: "2185c6f170d880028f61dcfb1b8376f4",
  name: "Wide Grip EZ Bar Preacher Curl",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Extend"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    stanceX: 0.2,
    heelZ: 0.42,
    feetMode: "hanging",
    lockHipFlexDeg: 92,
    frame: { type: "preacher", padTopY: 0.96, padTopZ: 0.22 },
  },
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.32,
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
    start: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 4, "knee.flex": 72, "elbow.flex": 16 },
    end: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 4, "knee.flex": 72, "elbow.flex": 128 },
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.2, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.2, 0.02, 0.52), 42),
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
      70,
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
      label: "Wide semi-underhand grip",
      cue: "Grasp the EZ bar wider than shoulder width with a semi-underhand grip, palms angled forward and inward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -10, "° of forearm pronation"),
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
