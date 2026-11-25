import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointWithinAt } from "../postures";
import { keepAbove } from "../solver";

/** Both heels about 15 cm up, head resting down, low back pressed flat. */
const HOLD = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 14,
  "thoracic.flex": 4,
  "neck.flex": 4,
  "hip.flex": 20,
  "hip.abd": 8,
  "knee.flex": 4,
  "ankle.dorsi": -6,
  "shoulder.elev": 14,
  "shoulder.plane": 72,
  "elbow.flex": 6,
  "forearm.pron": 50,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "six-inch-leg-raise-with-head-down",
  catalogId: "1f45c6f170d88004a6bee730e626b917",
  name: "Six-Inch Leg Raise With Head Down",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Lift", "Hold", "Hold"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "shoulder", "elbow", "neck", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, hip: 8, knee: 8 },
  extraGoals: (body) => [keepAbove(body, "heel_L", 0.08, 48), keepAbove(body, "heel_R", 0.08, 48)],
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkJointWithinAt(
      "heels-low",
      "Heels hover about six inches up",
      "While keeping your knees straight, lift both feet slightly, about 6 inches (15 centimeters), off the ground.",
      "hip_L.flex",
      "start",
      10,
      34,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep your knees straight while you hold both feet off the ground.",
      "knee_L.flex",
      "start",
      0,
      16,
    ),
    checkJointWithinAt(
      "low-back-pressed",
      "Lower back stays pressed into the floor",
      "Tighten your abdominal muscles to press your lower back into the ground so you cannot slide a hand under it.",
      "lumbar.flex",
      "start",
      4,
      26,
    ),
    checkJointWithinAt(
      "head-down",
      "Head stays down",
      "For this variation, rest your head on the ground or on your hands.",
      "neck.flex",
      "start",
      -8,
      14,
    ),
  ],
});
