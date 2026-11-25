import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Thumbs-up hang on thick handles. Upper arms stay pinned beside the ribs. */
const ARMS = {
  "shoulder.elev": 14,
  "shoulder.plane": 40,
  "shoulder.twist": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "standing-fat-grip-dumbbell-hammer-curl",
  catalogId: "2a95c6f170d8807b8876cbb06d90c203",
  name: "Standing Fat Grip Dumbbell Hammer Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", fatGrip: true },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 136 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.3, 0.04], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.3, 0.04], 18, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand upright in a hip-width stance and hold the dumbbells by your sides with straight elbows.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Hold the dumbbells by your sides with straight elbows as your palms face in toward your sides.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "At the top of the curl, your elbows should be fully bent with your forearms touching your biceps.",
      "elbow_L.flex",
      "bottom",
      115,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the dumbbells upward by bending your elbows, then lower them until the elbows are straight.",
      "elbow_L.flex",
      100,
    ),
    {
      id: "upper-arms-fixed",
      label: "Upper arms stay at the sides",
      cue: "Keep your upper arms fixed by your sides rather than allowing them to swing forward through shoulder motion.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.hypot(elbow.x - shoulder.x - 0.05, elbow.z - shoulder.z - 0.04) * 100;
          },
          5.5,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "neutral-grip",
      label: "Neutral fat-grip held throughout",
      cue: "Palms face in toward your sides in a hammer grip, with straight wrists, for the whole set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 22, "° away from a neutral forearm"),
    },
  ],
});
