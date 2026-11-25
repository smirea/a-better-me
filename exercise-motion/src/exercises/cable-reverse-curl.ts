import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low straight bar, overhand, upper arms slightly in front of the ribs. */
const ARMS = {
  "shoulder.elev": 26,
  "shoulder.plane": 74,
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": -2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "cable-reverse-curl",
  catalogId: "1a15c6f170d88047b707cb56112beab4",
  name: "Cable Reverse Curl",
  defaultLoadKg: 8,
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
  stiffness: { elbow: 4, shoulder: 2.4, lumbar: 8, forearm: 2.4 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 120 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.27, 0.1], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.27, 0.1], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack("Stand upright while gripping the bar and keep the upper arms fixed through the curl."),
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
      100,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the bar upward by bending at your elbows.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "overhand-grip",
      label: "Overhand reverse grip",
      cue: "Grasp the bar with an overhand grip such that your palms are directed back toward you.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"]) - 75),
          28,
          "° off an overhand grip",
        ),
    },
  ],
});
