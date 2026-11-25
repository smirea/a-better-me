import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointWithinAt } from "../postures";
import { keepAbove } from "../solver";

/** Same six-inch hover, with a small crunch so the head and shoulder blades stay up. */
const HOLD = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.16,
  "root.pitch": -78,
  "lumbar.flex": 14,
  "thoracic.flex": 20,
  "neck.flex": 20,
  "hip.flex": 20,
  "hip.abd": 8,
  "knee.flex": 4,
  "ankle.dorsi": -6,
  "shoulder.elev": 22,
  "shoulder.plane": 68,
  "elbow.flex": 10,
  "forearm.pron": 36,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "six-inch-leg-raise-with-head-up",
  catalogId: "1a45c6f170d880968596e3d5aa284e0c",
  name: "Six-Inch Leg Raise With Head Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Curl", "Hold", "Hold"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "elbow", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, thoracic: 12, hip: 8, knee: 8 },
  extraGoals: (body) => [
    keepAbove(body, "heel_L", 0.08, 48),
    keepAbove(body, "heel_R", 0.08, 48),
    keepAbove(body, "occiput", 0.06, 28),
  ],
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
      "head-up",
      "Head and shoulder blades stay up",
      "Tuck your chin toward your chest and mildly curl your upper back so your shoulder blades lift slightly off the ground.",
      "thoracic.flex",
      "start",
      10,
      34,
    ),
    checkJointWithinAt(
      "low-back-pressed",
      "Lower back stays pressed into the floor",
      "Tighten your abdominal muscles to press your lower back into the ground.",
      "lumbar.flex",
      "start",
      4,
      26,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Keep your knees straight for the whole hold.",
      "knee_L.flex",
      "start",
      0,
      16,
    ),
  ],
});
