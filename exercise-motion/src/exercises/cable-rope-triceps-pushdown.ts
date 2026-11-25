import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Elbows pinned at the ribs, neutral rope grip, slight hip hinge toward the high pulley. */
const ARMS = {
  "shoulder.elev": 22,
  "shoulder.plane": 28,
  "shoulder.twist": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 10,
  "hip.flex": 16,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "knee.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "cable-rope-triceps-pushdown",
  catalogId: "1a15c6f170d880479d38c49a76cb6b10",
  name: "Cable Rope Triceps Pushdown",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, torsoLeanDeg: 10, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 2.08, 0.72],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 0.34,
    gripX: 0.12,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 125 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 10 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.28, 0.04], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.08, -0.28, 0.04], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Take a step backward and slightly lean forward by hinging at your hips. Maintain this slight torso lean throughout the set.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start close to fully bent",
      "Pull your upper arms down and back until they are at your sides, with your elbows close to fully bent.",
      "elbow_L.flex",
      "top",
      105,
      145,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows straighten at the bottom",
      "Push the rope downward by extending your elbows until they are straightened.",
      "elbow_L.flex",
      "bottom",
      0,
      45,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend through the pushdown",
      "Push the rope downward and spread it apart by extending your elbows until they are straightened.",
      "elbow_L.flex",
      75,
    ),
    {
      id: "upper-arms-fixed",
      label: "Upper arms stay at the sides",
      cue: "Maintain this upper arm position throughout your set.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.hypot(elbow.x - shoulder.x - 0.08, elbow.z - shoulder.z - 0.04) * 100;
          },
          6,
          " cm of upper-arm drift",
        ),
    },
    {
      id: "neutral-grip",
      label: "Palms face inward on the rope",
      cue: "In this position, your palms should be facing inward.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° from neutral"),
    },
  ],
});
