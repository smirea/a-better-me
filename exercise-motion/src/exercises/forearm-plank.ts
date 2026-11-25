import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Elbows under the shoulders, fists on the mat, body in one line. */
const HOLD = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.32,
  "root.pitch": 80,
  "lumbar.flex": 12,
  "thoracic.flex": 8,
  "neck.flex": 2,
  "hip.flex": -2,
  "hip.abd": 6,
  "knee.flex": 3,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "clavicle.elev": 4,
  "shoulder.elev": 95,
  "shoulder.plane": 85,
  "shoulder.twist": 18,
  "elbow.flex": 92,
  "forearm.pron": 75,
  "wrist.flex": -35,
};

export const spec = buildExerciseSpec({
  id: "forearm-plank",
  catalogId: "1a45c6f170d880fabcebd578763b9c46",
  name: "Forearm Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Brace", "Hold", "Hold"],
  station: {
    kind: "pushup",
    forearmsOnFloor: true,
    handX: 0.2,
    handZ: 0.46,
    handElevationY: 0.05,
    feetElevationY: 0.05,
    footZ: -0.72,
    footX: 0.1,
  },
  stiffness: { hip: 8, ankle: 4, wrist: 8, shoulder: 8, elbow: 6 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_L", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
      { anchor: "forearmMid_R", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes to maintain a flat back so you can draw a straight line from your legs through your hips to your torso.",
    ),
    checkNeutralNeck("Keep your neck near a neutral position like you would normally do when standing upright."),
    checkJointWithinAt(
      "elbows-under-shoulders",
      "Elbows stay bent under the shoulders",
      "Prop your forearms onto the ground with your upper arms directed straight down, approximately perpendicular to the ground.",
      "elbow_L.flex",
      "start",
      75,
      115,
    ),
    checkJointWithinAt(
      "hips-not-sagging",
      "Hips stay up without an arched lower back",
      "Keep your hips up rather than letting them sag, which would result in an exaggerated arch in your lower back.",
      "lumbar.flex",
      "start",
      -6,
      32,
    ),
  ],
});
