import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low-pulley overhead extension: arms beside the ears, bar travels from behind the head to overhead. */
const ARMS = {
  "shoulder.elev": 96,
  "shoulder.plane": 40,
  "shoulder.twist": 16,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 36,
  "hip.flex": 40,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 20,
  "knee.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "cable-straight-bar-overhead-triceps-extension",
  catalogId: "1a15c6f170d880d2be19ea52502589f2",
  name: "Cable Straight Bar Overhead Triceps Extension",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.7, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: 0.02,
    torsoLeanDeg: 36,
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.75, -0.85],
    facingDir: 1,
    attachment: "straight-bar",
    gripX: 0.18,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 110 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 16, "shoulder.plane": 70 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.02, 0.16], 16, "xy"),
    holdElbowNearShoulder(body, "R", [0.08, -0.02, 0.16], 16, "xy"),
  ],
  checks: () => [
    checkFlatBack(
      "Adopt a staggered stance by stepping forward with one foot, and slightly lean forward by hinging at your hips. Maintain this position throughout your set.",
    ),
    checkJointWithinAt(
      "elbows-high-bent",
      "Elbows start high and bent",
      "Your upper arms are raised up high with your elbows close to being fully bent.",
      "elbow_L.flex",
      "top",
      60,
      140,
    ),
    checkJointWithinAt(
      "elbows-overhead",
      "Bar finishes overhead with straight elbows",
      "While keeping your elbows high, press the bar upward by extending your elbows until they are straightened. At the end of this motion, the bar should be situated above your head.",
      "elbow_L.flex",
      "bottom",
      0,
      40,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend overhead",
      "Press the bar upward by extending your elbows until they are straightened.",
      "elbow_L.flex",
      30,
    ),
    {
      id: "arms-stay-high",
      label: "Upper arms stay raised",
      cue: "While keeping your elbows high, press the bar upward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["shoulder_L.elev"]) - 100),
          35,
          "° off a high upper arm",
        ),
    },
    {
      id: "overhand-grip",
      label: "Overhand grip on the straight bar",
      cue: "While facing the cable station, grasp the bar with an overhand grip.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 70),
          25,
          "° off an overhand grip",
        ),
    },
  ],
});
