import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Semi-overhand EZ grip, upper arms fixed beside the ribs. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 66,
  "shoulder.twist": 14,
  "forearm.pron": 46,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "ez-bar-reverse-curl",
  catalogId: "29f5c6f170d8801f925fc12b1f739eb1",
  name: "EZ Bar Reverse Curl",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.7, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "ez",
    gripX: 0.2,
    alignWrists: false,
  },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 130 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.045, -0.29, 0.055], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.045, -0.29, 0.055], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stay upright with your shoulders stacked over your hips. Do not lean backward to lift the bar.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Stand fully upright and hold the bar in front of your legs with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Finish the lift once your elbows are fully bent, then lower under control.",
      "elbow_L.flex",
      "bottom",
      110,
      148,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the bar upward by bending your elbows while your upper arms stay by your sides.",
      "elbow_L.flex",
      95,
    ),
    {
      id: "upper-arms-fixed",
      label: "Upper arms stay at the sides",
      cue: "Keep your elbows and upper arms fixed by your sides. Do not swing them forward.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.hypot(elbow.x - shoulder.x - 0.045, elbow.z - shoulder.z - 0.055) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "semi-overhand",
      label: "Semi-overhand grip held throughout",
      cue: "Grasp the EZ bar with your palms angled backward and in toward each other.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -25, "° short of a semi-overhand grip"),
    },
  ],
});
