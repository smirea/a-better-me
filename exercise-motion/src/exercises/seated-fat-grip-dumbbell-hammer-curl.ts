import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Fat handles, thumbs up, upper arms beside the ribs on an upright bench. */
const ARMS = {
  "shoulder.elev": 22,
  "shoulder.plane": 58,
  "shoulder.twist": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "seated-fat-grip-dumbbell-hammer-curl",
  catalogId: "2a95c6f170d880c7b6bcc399ea82429c",
  name: "Seated Fat Grip Dumbbell Hammer Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.22,
    heelZ: 0.4,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells", fatGrip: true },
  hints: {
    start: { ...POSTURE_HINTS.seatedLeanBack, ...ARMS, "elbow.flex": 14, "root.pitch": -8 },
    end: { ...POSTURE_HINTS.seatedLeanBack, ...ARMS, "elbow.flex": 134, "shoulder.elev": 24, "root.pitch": -8 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.12, -0.28, 0.1], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.12, -0.28, 0.1], 18, "xz"),
  ],
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Sit down on a bench while holding the dumbbells by your sides with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      26,
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
      95,
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
            return Math.hypot(elbow.x - shoulder.x - 0.12, elbow.z - shoulder.z - 0.1) * 100;
          },
          6.5,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "neutral-grip",
      label: "Neutral fat-grip held throughout",
      cue: "Palms face in toward your sides in a neutral hammer grip, and stay that way through the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 22, "° away from a neutral forearm"),
    },
  ],
});
