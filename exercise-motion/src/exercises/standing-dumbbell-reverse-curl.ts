import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Overhand dumbbells, upper arms fixed beside the ribs. */
const ARMS = {
  "shoulder.elev": 14,
  "shoulder.plane": 46,
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-reverse-curl",
  catalogId: "1a15c6f170d880fe98b5de3ab0e91186",
  name: "Standing Dumbbell Reverse Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 130 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, -0.3, 0.05], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, -0.3, 0.05], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Pick up a pair of dumbbells and stand upright with approximately a shoulder width stance while holding the dumbbells at your sides with extended elbows.",
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Stand upright while holding the dumbbells at your sides with extended elbows.",
      "elbow_L.flex",
      "top",
      0,
      24,
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
            return Math.hypot(elbow.x - shoulder.x - 0.06, elbow.z - shoulder.z - 0.05) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "reverse-grip",
      label: "Reverse grip held throughout",
      cue: "Direct your palms so that they are facing behind you. Maintain this reverse grip on the dumbbells throughout the set.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -48, "° short of a reverse grip"),
    },
  ],
});
