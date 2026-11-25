import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** The bar rests dead on the floor long enough to reset before the next pull. */
const ARMS = {
  "shoulder.plane": 74,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "reset-conventional-deadlift",
  catalogId: "2a65c6f170d880e98f91e473693526b8",
  name: "Reset Conventional Deadlift",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Reset", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 1.5, raise: 1.3, top: 0.4 },
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
      "Sit your hips backward while bending your knees until your hands are level with the bar, with your lower back flat and chest up.",
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
      "floor-reset",
      "Pause with the plates on the floor",
      "Once the weight is fully resting on the ground, reset between reps before you pull again.",
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
      "bottom",
      0,
      18,
    ),
  ],
});
