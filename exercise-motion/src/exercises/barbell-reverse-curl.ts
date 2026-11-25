import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Overhand (pronated) shoulder-width grip, upper arms fixed. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 64,
  "shoulder.twist": 18,
  "forearm.pron": 72,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "barbell-reverse-curl",
  catalogId: "1a15c6f170d8806390e7e1743452b88c",
  name: "Barbell Reverse Curl",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.7, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    alignWrists: false,
  },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 130 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.04, -0.29, 0.055], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.04, -0.29, 0.055], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack("Stand upright and curl without leaning back or swinging the bar."),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Stand upright while gripping the bar with your elbows extended.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "After your elbows have fully flexed, lower the bar until they extend again.",
      "elbow_L.flex",
      "bottom",
      110,
      148,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the bar upward by bending at your elbows.",
      "elbow_L.flex",
      95,
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
            return Math.hypot(elbow.x - shoulder.x - 0.04, elbow.z - shoulder.z - 0.055) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "overhand-grip",
      label: "Overhand grip held throughout",
      cue: "Grasp the bar with a shoulder-width overhand grip so your palms face toward you.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -45, "° short of an overhand grip"),
    },
  ],
});
