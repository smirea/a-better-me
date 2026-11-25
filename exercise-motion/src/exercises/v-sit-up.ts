import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS_BACK = {
  "shoulder.elev": 168,
  "shoulder.plane": 82,
  "shoulder.twist": -20,
  "elbow.flex": 6,
  "forearm.pron": -72,
  "wrist.flex": 0,
};

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 8,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 6,
  "hip.abd": 4,
  "knee.flex": 8,
  "ankle.dorsi": -4,
  ...ARMS_BACK,
};

const UP = {
  ...DOWN,
  "root.y": 0.2,
  "root.pitch": -42,
  "lumbar.flex": 40,
  "thoracic.flex": 28,
  "neck.flex": 6,
  "hip.flex": 78,
  "knee.flex": 16,
  "ankle.dorsi": 4,
  "shoulder.elev": 148,
  "shoulder.plane": 88,
  "shoulder.twist": -8,
  "elbow.flex": 8,
  "forearm.pron": -40,
};

export const spec = buildExerciseSpec({
  id: "v-sit-up",
  catalogId: "1a45c6f170d880d7ba9aef42c91bf024",
  name: "V Sit-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Crunch", "Touch", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    pinSacrum: false,
    passiveJoints: ["ankle", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 14, thoracic: 12, hip: 4, knee: 3, shoulder: 2 },
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "The whole back curls off the floor",
      "Lift the entirety of your back off the ground, resulting in only your buttocks contacting the ground at the top. Intentionally curl your spine.",
      "lumbar.flex",
      18,
    ),
    checkJointRange(
      "hip-lift",
      "Both legs lift with the torso",
      "While only allowing your knees to bend mildly, lift both legs up simultaneously with your torso as you crunch up to touch your feet.",
      "hip_L.flex",
      35,
    ),
    checkJointWithinAt(
      "knees-near-straight",
      "Knees stay nearly straight",
      "Keep your elbows straight and your knees as close to straight as your hamstring flexibility permits.",
      "knee_L.flex",
      "peak",
      0,
      32,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Sweep your arms toward your feet in an arcing manner with straight elbows until they angle upward and forward.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally standing upright and looking straight ahead."),
  ],
});
