import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Low-pulley V-bar overhead extension: palms in, elbows stay high beside the head. */
const ARMS = {
  "shoulder.elev": 140,
  "shoulder.plane": 80,
  "shoulder.twist": 4,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": 2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 14,
  "hip.flex": 18,
  "lumbar.flex": 6,
  "thoracic.flex": 2,
  "neck.flex": 16,
  "knee.flex": 10,
};

export const spec = buildExerciseSpec({
  id: "cable-v-bar-overhead-triceps-extension",
  catalogId: "1b25c6f170d880bdab0fd60e200b2abf",
  name: "Cable V-Bar Overhead Triceps Extension",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Stretch"],
  tempo: { lower: 2.2, bottom: 0.45, raise: 2.4, top: 0.5 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: -0.02,
    torsoLeanDeg: 16,
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.68, -0.85],
    facingDir: 1,
    attachment: "v-bar",
    gripX: 0.08,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "shoulder.elev": 145, "elbow.flex": 128 },
    end: { ...TRUNK, ...ARMS, "shoulder.elev": 148, "elbow.flex": 12 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, 0.0, 0.14], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, 0.0, 0.14], 16, "xz"),
  ],
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "elbow_L.flex", 128, 18), lockAngle(body, "elbow_R.flex", 128, 18)],
    end: [lockAngle(body, "elbow_L.flex", 14, 24), lockAngle(body, "elbow_R.flex", 14, 24)],
  }),
  checks: () => [
    checkFlatBack(
      "Adopt a staggered stance by stepping forward with one foot, and slightly lean forward by hinging at your hips. Maintain this position throughout your set.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start high and bent",
      "Your upper arms are raised up high with your elbows close to being fully bent with fairly straight wrists.",
      "elbow_L.flex",
      "top",
      105,
      148,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "V-bar finishes above the head",
      "While keeping your elbows high, press the V-bar upward by extending your elbows until they are straightened.",
      "elbow_L.flex",
      "bottom",
      0,
      36,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend overhead",
      "Press the V-bar upward by extending your elbows until they are straightened.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "palms-in",
      label: "Palms face inward on the V-bar",
      cue: "Grasp the V-bar with your palms facing in toward each other.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 20),
          30,
          "° off a palms-in grip",
        ),
    },
  ],
});
