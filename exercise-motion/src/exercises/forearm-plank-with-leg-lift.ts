import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.32,
  "root.pitch": 80,
  "lumbar.flex": 12,
  "thoracic.flex": 8,
  "neck.flex": 2,
  "hip.abd": 7,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "clavicle.elev": 4,
  "shoulder.elev": 90,
  "shoulder.plane": 80,
  "shoulder.twist": 4,
  "elbow.flex": 92,
  "forearm.pron": 75,
  "wrist.flex": -35,
};

const START = {
  ...PLANK,
  "hip.flex": 2,
  "knee.flex": 4,
};

/** Left leg lifts about parallel to the floor. The right leg and both forearms stay down. */
const PEAK = sidedHints("L", { "hip.flex": -12, "knee.flex": 4 }, { "hip.flex": 4, "knee.flex": 4 }, PLANK);

export const spec = buildExerciseSpec({
  id: "forearm-plank-with-leg-lift",
  catalogId: "1f55c6f170d8803dba14eefc04ac5e66",
  name: "Forearm Plank With Leg Lift",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "Lift", "Switch", "Lift"],
  tempo: { lower: 1.1, bottom: 0.35, raise: 1.1, top: 0.45 },
  station: {
    kind: "pushup",
    forearmsOnFloor: true,
    handX: 0.2,
    handZ: 0.46,
    handElevationY: 0.05,
    feetElevationY: 0.04,
    footZ: -0.72,
    footX: 0.12,
    plantFeet: false,
  },
  stiffness: { hip: 4, lumbar: 14, thoracic: 12, shoulder: 16, elbow: 8, knee: 8 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_L", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
      { anchor: "forearmMid_R", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Keep your abdominal muscles and glutes tightened so your lower back does not arch and the lifted hip does not tilt up.",
      12,
    ),
    checkNeutralNeck("Keep your neck near a neutral position like you would normally do when standing upright."),
    checkJointWithinAt(
      "elbows-under-shoulders",
      "Elbows stay bent under the shoulders",
      "Prop your forearms onto the ground with your upper arms directed straight down.",
      "elbow_L.flex",
      "peak",
      75,
      115,
    ),
    checkJointRange(
      "leg-lifts",
      "One straight leg lifts",
      "While keeping your knees straightened, lift one foot slightly up off the ground, about parallel to the floor.",
      "hip_L.flex",
      10,
    ),
    checkJointWithinAt(
      "knee-straight",
      "The lifted knee stays straight",
      "Lift the foot with the knee straightened rather than marching the knee in.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
  ],
});
