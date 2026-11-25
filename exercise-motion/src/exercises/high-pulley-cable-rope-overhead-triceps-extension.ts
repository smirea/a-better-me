import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** High-pulley rope: same forward lean as the bar variant, neutral grip, elbows held out in front. */
const ARMS = {
  "shoulder.elev": 96,
  "shoulder.plane": 42,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 36,
  "hip.flex": 40,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 20,
  "knee.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "high-pulley-cable-rope-overhead-triceps-extension",
  catalogId: "1a15c6f170d880c5bf1ffee363122476",
  name: "High Pulley Cable Rope Overhead Triceps Extension",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.7, top: 0.4 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: 0.02,
    torsoLeanDeg: 36,
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 1.92, -0.85],
    facingDir: 1,
    attachment: "rope",
    attachmentWidth: 0.26,
    gripX: 0.07,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 110 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 16, "shoulder.plane": 72 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.07, -0.02, 0.16], 16, "xy"),
    holdElbowNearShoulder(body, "R", [0.07, -0.02, 0.16], 16, "xy"),
  ],
  checks: () => [
    checkFlatBack(
      "Step forward and adopt a staggered stance before moderately leaning forward by hinging at your hips. Maintain this forward torso lean throughout your set.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Hands start behind the head",
      "In this position, your hands should be behind your head, and you should feel tension from the cable.",
      "elbow_L.flex",
      "top",
      60,
      130,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Rope finishes in front",
      "Press the rope forward and somewhat downward by extending your elbows until they are straightened. At the end of this motion, the rope should be situated in front of you.",
      "elbow_L.flex",
      "bottom",
      0,
      50,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows do the work",
      "Strive to continue keeping your upper arms stationary while all of the movement occurs from elbow motion rather than also involving shoulder motion.",
      "elbow_L.flex",
      22,
    ),
    {
      id: "neutral-grip",
      label: "Neutral grip on the rope",
      cue: "Grasp the ends of the rope with a neutral grip such that your palms are facing in toward each other.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 30, "° from neutral"),
    },
  ],
});
