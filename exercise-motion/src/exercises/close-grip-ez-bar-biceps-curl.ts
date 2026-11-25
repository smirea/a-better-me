import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Close semi-underhand grip on the inner EZ angles. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 70,
  "shoulder.twist": -6,
  "forearm.pron": -40,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

export const spec = buildExerciseSpec({
  id: "close-grip-ez-bar-biceps-curl",
  catalogId: "1a15c6f170d880ac85f8eed3680b93ec",
  name: "Close Grip EZ Bar Biceps Curl",
  defaultLoadKg: 14,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.7, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.12,
    alignWrists: false,
  },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 136 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.03, -0.29, 0.05], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.03, -0.29, 0.05], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack("Stand fully upright and keep your torso still while you curl."),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Stand fully upright while gripping the EZ bar with your elbows extended.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "After your elbows have fully flexed, lower the bar until they extend again.",
      "elbow_L.flex",
      "bottom",
      115,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the bar upward by bending at your elbows.",
      "elbow_L.flex",
      100,
    ),
    checkJointWithinAt(
      "close-grip",
      "Closer than shoulder width",
      "Grasp the EZ bar with a closer than shoulder-width semi-underhand grip.",
      "forearm_L.pron",
      "start",
      -70,
      -15,
    ),
    {
      id: "upper-arms-fixed",
      label: "Upper arms stay at the sides",
      cue: "Keep your upper arms fixed at your sides rather than allowing your upper arms to swing forward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.hypot(elbow.x - shoulder.x - 0.03, elbow.z - shoulder.z - 0.05) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "semi-underhand",
      label: "Semi-underhand EZ grip",
      cue: "Use a semi-underhand grip so your palms angle forward and inward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -15, "° of forearm pronation"),
    },
  ],
});
