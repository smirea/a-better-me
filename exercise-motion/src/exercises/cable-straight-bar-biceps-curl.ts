import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low straight bar, underhand, upper arms a little in front of the ribs for the diagonal cable. */
const ARMS = {
  "shoulder.elev": 26,
  "shoulder.plane": 74,
  "shoulder.twist": -14,
  "forearm.pron": -76,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "cable-straight-bar-biceps-curl",
  catalogId: "1a15c6f170d8809bba44ff563ead6a65",
  name: "Cable Straight Bar Biceps Curl",
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
    attachmentWidth: 0.56,
    gripX: 0.18,
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
      "Stand upright while gripping the bar and keep your torso still while you curl.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "While keeping your elbows extended, stand upright while gripping the bar.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "After your elbows have fully flexed, reverse the motion by lowering the bar.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the bar upward by bending at your elbows.",
      "elbow_L.flex",
      95,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Grasp the bar with approximately a shoulder width grip and an underhand grip such that your palms are directed forward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -48, "° of forearm pronation"),
    },
  ],
});
