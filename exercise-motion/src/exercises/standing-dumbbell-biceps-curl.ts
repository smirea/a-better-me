import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Shoulder-width heels, palms forward, upper arms pinned beside the ribs for a strict curl. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 58,
  "shoulder.twist": -18,
  "forearm.pron": -80,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-biceps-curl",
  catalogId: "1a15c6f170d880f1ba5ef781b583618a",
  name: "Standing Dumbbell Biceps Curl",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 7 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "elbow.flex": 6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "elbow.flex": 138 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.045, -0.3, 0.055], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.045, -0.3, 0.055], 18, "xz"),
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
      22,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "After your elbows have fully flexed, reverse the motion by lowering the dumbbells.",
      "elbow_L.flex",
      "bottom",
      115,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl both dumbbells upward by bending at your elbows.",
      "elbow_L.flex",
      100,
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
            return Math.hypot(elbow.x - shoulder.x - 0.045, elbow.z - shoulder.z - 0.055) * 100;
          },
          5,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Direct your palms so that they are facing forward. Maintain this underhand grip on the dumbbells throughout the set.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => deg(angles["forearm_L.pron"]),
          -55,
          "° of forearm pronation",
        ),
    },
  ],
});
