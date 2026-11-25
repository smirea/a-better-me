import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

/** Supinated dumbbells, upper arms along the preacher pad. */
const ARMS = {
  "shoulder.elev": 56,
  "shoulder.plane": 100,
  "shoulder.twist": 4,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-preacher-curl",
  catalogId: "29f5c6f170d8800f9577c4c1d85c2900",
  name: "Dumbbell Preacher Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
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
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 8, forearm: 4 },
  extraContacts: {
    "preacher.armPad": {
      upperarm_L: 0.08,
      upperarm_R: 0.08,
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
    start: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 6, "knee.flex": 72, "elbow.flex": 16 },
    end: { ...POSTURE_HINTS.seated, ...ARMS, "root.y": 0.55, "root.pitch": 6, "knee.flex": 72, "elbow.flex": 108 },
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.18, 0.02, 0.52), 42),
    pin(body, "heel_R", () => new Vector3(-0.18, 0.02, 0.52), 42),
  ],
  extraKeyGoals: (body) => ({
    end: [
      lockAngle(body, "elbow_L.flex", 108, 220),
      lockAngle(body, "elbow_R.flex", 108, 220),
    ],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Lower the dumbbells until you have fully straightened your elbows, with your upper arms on the pad.",
      "elbow_L.flex",
      "top",
      0,
      32,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows flex at the peak",
      "Curl the dumbbells upward and back toward you until your elbows are fully bent.",
      "elbow_L.flex",
      "bottom",
      90,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Preacher curl",
      "While keeping your elbows and triceps on the arm pad, curl the dumbbells by bending your elbows.",
      "elbow_L.flex",
      65,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Hold the dumbbells with your palms facing forward, and avoid rotating your palms.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -48, "° of forearm pronation"),
    },
    {
      id: "upper-arms-on-pad",
      label: "Upper arms stay on the pad",
      cue: "Keep your elbows and triceps snugly against the arm pad while the rest of your body stays still.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => {
          const s0 = deg(context.angles[context.top]["shoulder_L.elev"]);
          return Math.abs(deg(angles["shoulder_L.elev"]) - s0);
        }, 12, "° of upper-arm drift"),
    },
  ],
});
