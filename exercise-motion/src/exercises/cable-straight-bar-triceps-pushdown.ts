import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Overhand straight-bar pushdown: elbows glued to the ribs, slight hinge toward the high pulley. */
const ARMS = {
  "shoulder.elev": 20,
  "shoulder.plane": 24,
  "shoulder.twist": 18,
  "forearm.pron": 72,
  "wrist.flex": -4,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 10,
  "hip.flex": 16,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "knee.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "cable-straight-bar-triceps-pushdown",
  catalogId: "1a15c6f170d8801d9337dba3dcb34a88",
  name: "Cable Straight Bar Triceps Pushdown",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, torsoLeanDeg: 10, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 2.08, 0.72],
    facingDir: -1,
    attachment: "straight-bar",
    gripX: 0.18,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 122 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 8 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.1, -0.28, 0.05], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.1, -0.28, 0.05], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Take a step backward and slightly lean forward by hinging at your hips. Maintain this slight torso lean throughout your set.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start close to fully bent",
      "Pull your upper arms down and back until they are positioned at your sides with your elbows close to fully bent.",
      "elbow_L.flex",
      "top",
      100,
      145,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows straighten in front of the thighs",
      "Push the bar downward by extending your elbows until they are straightened. At the end of this motion, the bar should be situated in front of your thighs.",
      "elbow_L.flex",
      "bottom",
      0,
      45,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow extension",
      "Push the bar downward by extending your elbows until they are straightened.",
      "elbow_L.flex",
      75,
    ),
    {
      id: "overhand-grip",
      label: "Overhand grip, palms facing away",
      cue: "Grasp the bar with an overhand grip such that your palms are facing away from you.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 72),
          25,
          "° off an overhand grip",
        ),
    },
  ],
});
