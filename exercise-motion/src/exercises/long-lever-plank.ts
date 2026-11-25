import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Forearms slid forward so the elbows sit under the eyes, body still one line. */
const HOLD = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.32,
  "root.z": -0.04,
  "root.pitch": 82,
  "lumbar.flex": 12,
  "thoracic.flex": 8,
  "neck.flex": 6,
  "hip.flex": 2,
  "hip.abd": 6,
  "knee.flex": 4,
  "ankle.dorsi": 6,
  "clavicle.prot": 14,
  "clavicle.elev": 6,
  "shoulder.elev": 125,
  "shoulder.plane": 82,
  "shoulder.twist": 16,
  "elbow.flex": 88,
  "forearm.pron": 75,
  "wrist.flex": -30,
};

export const spec = buildExerciseSpec({
  id: "long-lever-plank",
  catalogId: "1a45c6f170d880d69885eaefae2ee848",
  name: "Long Lever Plank",
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
    handZ: 0.64,
    handElevationY: 0.05,
    feetElevationY: 0.05,
    footZ: -0.68,
    footX: 0.1,
  },
  stiffness: { hip: 8, ankle: 4, wrist: 8, shoulder: 10, elbow: 6 },
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
      "arms-reached-forward",
      "Upper arms reach forward of the shoulders",
      "Move your arms forward so your upper arms are directed forward and downward, with your elbows under your eyes.",
      "shoulder_L.elev",
      "start",
      95,
      140,
    ),
    checkJointWithinAt(
      "hips-not-sagging",
      "Hips stay up without an arched lower back",
      "Keep your hips held up rather than letting them sag downward, which would result in an exaggerated arch of your lower back.",
      "lumbar.flex",
      "start",
      -6,
      34,
    ),
  ],
});
