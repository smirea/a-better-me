import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Pronated reverse grip, upper arms beside the ribs. */
const ARMS = {
  "shoulder.elev": 22,
  "shoulder.plane": 72,
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-reverse-curl",
  catalogId: "1a15c6f170d880e18902d19b0f0c8b3d",
  name: "Seated Dumbbell Reverse Curl",
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
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.seatedLeanBack, ...ARMS, "elbow.flex": 12, "root.pitch": -8 },
    end: { ...POSTURE_HINTS.seatedLeanBack, ...ARMS, "elbow.flex": 128, "root.pitch": -8 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.16, -0.27, 0.18], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.16, -0.27, 0.18], 18, "xz"),
  ],
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Sit down on a bench while holding the dumbbells at your sides with extended elbows.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl both dumbbells upward by bending at your elbows.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "After your elbows have fully flexed, reverse the motion until your elbows have returned to an extended position.",
      "elbow_L.flex",
      85,
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
            return Math.hypot(elbow.x - shoulder.x - 0.16, elbow.z - shoulder.z - 0.18) * 100;
          },
          6.5,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "reverse-grip",
      label: "Reverse grip held throughout",
      cue: "Direct your palms so that they are facing back behind you. Maintain this reverse grip on the dumbbells throughout the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -48, "° short of a reverse grip"),
    },
  ],
});
