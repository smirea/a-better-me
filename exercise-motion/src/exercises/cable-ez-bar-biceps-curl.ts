import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low curl bar, semi-underhand, upper arms a little in front of the torso. */
const ARMS = {
  "shoulder.elev": 24,
  "shoulder.plane": 72,
  "shoulder.twist": -8,
  "forearm.pron": -40,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "cable-ez-bar-biceps-curl",
  catalogId: "2a05c6f170d88068b1f8e50b33c87079",
  name: "Cable EZ Bar Biceps Curl",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.17, heelZ: -0.08, toeOutDeg: 6, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.28, 0.95],
    columnPos: [0, 1.12],
    facingDir: -1,
    attachment: "straight-bar",
    gripX: 0.2,
  },
  stiffness: { elbow: 4, shoulder: 2.4, lumbar: 8 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 132 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.27, 0.1], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.27, 0.1], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand upright with the bar just in front of your legs and keep the rest of your body stationary.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start straight",
      "While keeping your elbows straight, stand upright with the bar just in front of your legs.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows finish fully bent",
      "Curl the bar upward and back toward you by bending your elbows until they are fully bent.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the bar upward and back toward you in an arcing motion by bending your elbows.",
      "elbow_L.flex",
      95,
    ),
    {
      id: "semi-underhand",
      label: "Semi-underhand grip",
      cue: "Grasp the bar with a near shoulder width semi-underhand grip such that your palms are directed forward and inward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) + 40),
          24,
          "° off a semi-underhand grip",
        ),
    },
  ],
});
