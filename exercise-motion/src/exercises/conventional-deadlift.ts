import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hip-width stance, bar over mid-foot, plates dead-stopped on the floor. */
const ARMS = {
  "shoulder.plane": 74,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "conventional-deadlift",
  catalogId: "1a35c6f170d880f7a755cd3780a63371",
  name: "Conventional Deadlift",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Floor", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.8, raise: 1.3, top: 0.4 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8, startZ: 0.14, endY: 0.24, endZ: 0.24, arcBulgeZ: 0.08 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.74,
      "root.z": -0.02,
      "root.pitch": 36,
      "hip.flex": 88,
      "hip.abd": 4,
      "knee.flex": 74,
      "ankle.dorsi": 16,
      "shoulder.elev": 22,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and chest up rather than rounding your back as you reach the bar.",
      16,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkJointRange(
      "floor-pull",
      "Hips and knees extend from the floor",
      "Drive through your legs to begin lifting the bar as you push the floor away while extending your hips and knees.",
      "knee_L.flex",
      50,
    ),
    checkJointWithinAt(
      "floor-start",
      "Plates rest on the floor",
      "Allow the weight to come to a dead stop on the ground for a moment before you pull again.",
      "hip_L.flex",
      "bottom",
      55,
      125,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "With your elbows fully straightened, firmly grasp the bar with an approximately shoulder-width overhand grip.",
      "elbow_L.flex",
      "start",
      0,
      18,
    ),
  ],
});
