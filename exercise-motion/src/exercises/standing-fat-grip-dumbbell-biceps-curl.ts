import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Thick handles. The curl starts hammer and finishes underhand, then supination unwinds on the way down. */
const TRUNK = {
  "shoulder.elev": 14,
  "shoulder.plane": 48,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "standing-fat-grip-dumbbell-biceps-curl",
  catalogId: "2a95c6f170d880c79ad0e9ecc4f0d855",
  name: "Standing Fat Grip Dumbbell Biceps Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", fatGrip: true },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...TRUNK,
      "shoulder.twist": 4,
      "forearm.pron": 0,
      "elbow.flex": 6,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...TRUNK,
      "shoulder.elev": 16,
      "shoulder.twist": -16,
      "forearm.pron": -78,
      "elbow.flex": 136,
    },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.3, 0.05], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.3, 0.05], 18, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand upright in a hip-width stance and hold the dumbbells by your sides with straight elbows.",
    ),
    checkJointWithinAt(
      "starts-neutral",
      "Starts in a hammer grip",
      "Hold the dumbbells by your sides with palms facing in toward your sides.",
      "forearm_L.pron",
      "top",
      -22,
      22,
    ),
    checkJointWithinAt(
      "finishes-supinated",
      "Finishes underhand",
      "At the top of the curl you are holding the dumbbells with an underhand grip rather than the neutral grip you used to start.",
      "forearm_L.pron",
      "bottom",
      -85,
      -55,
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Hold the dumbbells by your sides with straight elbows.",
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
      "Curl the dumbbells upward by bending your elbows, then lower them until the elbows are straightened.",
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
            return Math.hypot(elbow.x - shoulder.x - 0.05, elbow.z - shoulder.z - 0.05) * 100;
          },
          5.5,
          " cm of upper-arm drift",
        ),
    },
  ],
});
