import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral (hammer) grip, upper arms pinned beside the ribs. */
const ARMS = {
  "shoulder.elev": 18,
  "shoulder.plane": 42,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-hammer-curl",
  catalogId: "1a15c6f170d880bab696d2c062c14ddd",
  name: "Seated Dumbbell Hammer Curl",
  defaultLoadKg: 12,
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
    end: { ...POSTURE_HINTS.seatedLeanBack, ...ARMS, "elbow.flex": 132, "root.pitch": -8 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.1, -0.28, 0.08], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.1, -0.28, 0.08], 16, "xz"),
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
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "After your elbows have fully flexed, reverse the motion until your elbows have returned to an extended position.",
      "elbow_L.flex",
      90,
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
            return Math.hypot(elbow.x - shoulder.x - 0.1, elbow.z - shoulder.z - 0.08) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "neutral-grip",
      label: "Neutral grip held throughout",
      cue: "Direct your palms so that they are facing in toward your sides. Maintain this neutral grip on the dumbbells throughout the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 22, "° away from a neutral forearm"),
    },
  ],
});
