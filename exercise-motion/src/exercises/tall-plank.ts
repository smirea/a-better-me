import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Top of a push-up: straight arms, palms under the shoulders, body in one line. */
const HOLD = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.4,
  "root.pitch": 84,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 0,
  "hip.abd": 6,
  "knee.flex": 4,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "clavicle.elev": 4,
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 78,
  "wrist.flex": 42,
};

export const spec = buildExerciseSpec({
  id: "tall-plank",
  catalogId: "1a45c6f170d88028b4f5e2009e0298a7",
  name: "Tall Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Brace", "Hold", "Hold"],
  station: {
    kind: "pushup",
    forearmsOnFloor: false,
    handX: 0.26,
    handZ: 0.5,
    handElevationY: 0.05,
    feetElevationY: 0.04,
    footZ: -0.72,
    footX: 0.1,
  },
  stiffness: { hip: 6, ankle: 4, wrist: 4 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes to maintain a flat back so you can draw a straight line from your legs through your hips to your torso.",
    ),
    checkNeutralNeck("Keep your neck in a neutral position, as you would normally do when standing upright."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "You should now be in the same position as the top of a push-up, keeping your elbows straight.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "hips-not-sagging",
      "Hips stay up without an arched lower back",
      "Keep your hips held up rather than letting them sag downward, which would result in an exaggerated arch of your lower back.",
      "lumbar.flex",
      "start",
      -2,
      22,
    ),
  ],
});
