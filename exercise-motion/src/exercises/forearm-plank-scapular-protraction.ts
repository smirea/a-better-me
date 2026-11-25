import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.pitch": 80,
  "lumbar.flex": 10,
  "neck.flex": 2,
  "hip.flex": 2,
  "hip.abd": 6,
  "knee.flex": 10,
  "ankle.dorsi": 16,
  "clavicle.elev": 4,
  "shoulder.elev": 95,
  "shoulder.plane": 85,
  "shoulder.twist": 16,
  "elbow.flex": 92,
  "forearm.pron": 75,
  "wrist.flex": -35,
};

export const spec = buildExerciseSpec({
  id: "forearm-plank-scapular-protraction",
  catalogId: "2bf5c6f170d880e6aab7c3cc86586031",
  name: "Forearm Plank Scapular Protraction",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Spread", "Round", "Return", "Together"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: {
    kind: "pushup",
    forearmsOnFloor: true,
    handX: 0.2,
    handZ: 0.46,
    handElevationY: 0.09,
    feetElevationY: 0.05,
    footZ: -0.72,
    footX: 0.1,
  },
  stiffness: { hip: 8, elbow: 8, clavicle: 1.1, shoulder: 6, knee: 8, ankle: 6 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 8, 28),
    lockAngle(body, "knee_R.flex", 8, 28),
    lockAngle(body, "ankle_L.dorsi", 12, 22),
    lockAngle(body, "ankle_R.dorsi", 12, 22),
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_L", bodyweightShare: 0.32, grip: "press", direction: [0, 1, 0] },
      { anchor: "forearmMid_R", bodyweightShare: 0.32, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: {
    start: { ...PLANK, "root.y": 0.28, "clavicle.prot": -10, "thoracic.flex": 2 },
    end: { ...PLANK, "root.y": 0.36, "clavicle.prot": 22, "thoracic.flex": 14 },
  },
  checks: () => [
    checkFlatBack(
      "Brace the abdominals and glutes so the hips stay up and the lower back does not sag.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral, gaze slightly ahead on the floor."),
    checkJointWithinAt(
      "elbows-down",
      "Forearms stay on the floor",
      "Push the floor away with the shoulder blades while the elbows and forearms stay down.",
      "elbow_L.flex",
      "peak",
      75,
      115,
    ),
    checkJointWithinAt(
      "protracted",
      "Shoulder blades finish spread",
      "Spread the shoulder blades apart so the chest lifts a little and the upper back rounds mildly.",
      "clavicle_L.prot",
      "peak",
      12,
      26,
    ),
    checkJointRange(
      "scapular-protraction",
      "Scapulae protract and retract",
      "Let the blades move back together under control, then push the floor away again.",
      "clavicle_L.prot",
      18,
    ),
  ],
});
