import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

/** Thick handles, thumbs up, both upper arms on the preacher pad. */
const ARMS = {
  "shoulder.elev": 40,
  "shoulder.plane": 64,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.55,
  "root.pitch": 4,
  "knee.flex": 72,
};

export const spec = buildExerciseSpec({
  id: "fat-grip-dumbbell-preacher-hammer-curl",
  catalogId: "2a95c6f170d880df81b4fd53b4fee5d4",
  name: "Fat Grip Dumbbell Preacher Hammer Curl",
  defaultLoadKg: 6,
  loadUnit: "perSide",
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
  apparatus: { kind: "dumbbells", fatGrip: true },
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
    start: { ...SEAT, ...ARMS, "elbow.flex": 16 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 120 },
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.2, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.2, 0.02, 0.52), 42),
  ],
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
      75,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Fat-grip preacher hammer curl",
      "Bend the elbows to curl the dumbbells upward and back toward you.",
      "elbow_L.flex",
      60,
    ),
    {
      id: "neutral-grip",
      label: "Neutral fat-grip held throughout",
      cue: "Hold the dumbbells with palms facing in toward each other, and do not rotate the palms.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 22, "° away from a neutral forearm"),
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
