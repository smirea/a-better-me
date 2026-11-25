import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Low-pulley rope overhead extension, neutral grip, staggered brace facing away from the stack. */
const ARMS = {
  "shoulder.elev": 150,
  "shoulder.plane": 80,
  "shoulder.twist": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": 2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 14,
  "hip.flex": 18,
  "lumbar.flex": 6,
  "thoracic.flex": 2,
  "neck.flex": 18,
  "knee.flex": 10,
};

export const spec = buildExerciseSpec({
  id: "cable-rope-overhead-triceps-extension",
  catalogId: "1a15c6f170d880e8ad58cebec203e231",
  name: "Cable Rope Overhead Triceps Extension",
  defaultLoadKg: 3,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Stretch"],
  tempo: { lower: 2.2, bottom: 0.45, raise: 2.4, top: 0.5 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: 0.0,
    torsoLeanDeg: 14,
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.62, -0.85],
    facingDir: 1,
    attachment: "rope",
    attachmentWidth: 0.28,
    gripX: 0.08,
  },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 124 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 18, "shoulder.elev": 156 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, 0.0, -0.02], 14, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, 0.0, -0.02], 14, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Take a step forward, and slightly lean your torso forward by hinging at your hips while standing in a staggered stance.",
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start bent behind the head",
      "Your upper arms are raised up high with your elbows close to being fully bent as the cable is applying a downward force to the rope behind your head.",
      "elbow_L.flex",
      "top",
      100,
      145,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Rope finishes above the head",
      "While keeping your elbows high, press the rope upward by extending your elbows until they are straightened. At the end of this motion, the rope should be situated above your head.",
      "elbow_L.flex",
      "bottom",
      0,
      32,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend overhead",
      "Press the rope upward by extending your elbows until they are straightened.",
      "elbow_L.flex",
      80,
    ),
    {
      id: "neutral-grip",
      label: "Neutral grip, palms toward each other",
      cue: "Grasp the ends of the rope with a neutral grip such that your palms are facing in toward each other.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 30, "° from neutral"),
    },
  ],
});
