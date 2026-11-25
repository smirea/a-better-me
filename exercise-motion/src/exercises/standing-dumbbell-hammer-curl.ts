import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Thumbs-up hang: upper arms pinned beside the ribs, forearms stay neutral. */
const ARMS = {
  "shoulder.elev": 14,
  "shoulder.plane": 40,
  "shoulder.twist": 6,
  "forearm.pron": 2,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-hammer-curl",
  catalogId: "1a15c6f170d880868c06f216e31047c3",
  name: "Standing Dumbbell Hammer Curl",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
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
      "Pick up a pair of dumbbells and stand upright with approximately a hip-width stance while holding the dumbbells at your sides with extended elbows.",
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
      "Curl both dumbbells upward by fully bending your elbows.",
      "elbow_L.flex",
      "bottom",
      115,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "After your elbows have fully flexed, reverse the motion by lowering the dumbbells until your elbows have returned to an extended position.",
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
            return Math.hypot(elbow.x - shoulder.x - 0.05, elbow.z - shoulder.z - 0.04) * 100;
          },
          5.5,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "neutral-grip",
      label: "Neutral grip held throughout",
      cue: "Direct your palms so that they are facing in toward your sides. Maintain this neutral grip on the dumbbells throughout the set.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["forearm_L.pron"])),
          22,
          "° away from a neutral forearm",
        ),
    },
  ],
});
