import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Supine on a flat bench, a small crunch holding the head up.
 * Upper arms hang off the sides, slightly behind the torso, and only the elbows move.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "neck.flex": 16,
  "thoracic.flex": -4,
  "lumbar.flex": -6,
};

const ARMS = {
  "shoulder.elev": 72,
  "shoulder.plane": -16,
  "shoulder.twist": -18,
  "forearm.pron": -78,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -6,
};

export const spec = buildExerciseSpec({
  id: "lying-dumbbell-biceps-curl",
  catalogId: "30d5c6f170d880139d7bf1580c178fc7",
  name: "Lying Dumbbell Biceps Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Curl", "Peak", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.22,
    heelZ: 0.46,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...TRUNK, ...ARMS, "elbow.flex": 12 },
    end: { ...TRUNK, ...ARMS, "elbow.flex": 128 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.22, -0.16, -0.04], 28, "xyz"),
    holdElbowNearShoulder(body, "R", [0.22, -0.16, -0.04], 28, "xyz"),
    lockAngle(body, "neck.flex", 16, 22),
  ],
  checks: () => [
    checkFeetPlanted("Once you are lying down, your feet should be flat on the ground under bent knees."),
    checkJointWithinAt(
      "head-up",
      "Head stays lifted in a slight crunch",
      "Tuck your chin toward your chest to lift your head off the bench, and keep that position through the set.",
      "neck.flex",
      "top",
      8,
      36,
    ),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended beside the bench",
      "Straighten your elbows and let the weights pull your arms down toward the ground, slightly out from your sides.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the dumbbells upward by fully bending your elbows without moving your upper arms.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Lower the dumbbells until the elbows are fully straightened, then curl them back up.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "underhand-grip",
      label: "Underhand grip held throughout",
      cue: "Point your palms backward to assume an underhand grip, and keep the wrists straight.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -50, "° of forearm pronation"),
    },
  ],
});
