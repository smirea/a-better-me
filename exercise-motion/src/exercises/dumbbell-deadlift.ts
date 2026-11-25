import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Neutral grip, arms hanging straight toward the handles. */
const ARMS = {
  "shoulder.plane": 18,
  "shoulder.twist": 4,
  "elbow.flex": 5,
  "forearm.pron": 8,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-deadlift",
  catalogId: "3065c6f170d8807abd9fc6be633e0b19",
  name: "Dumbbell Deadlift",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Floor", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.7, raise: 1.3, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.72,
      "root.z": -0.04,
      "root.pitch": 40,
      "hip.flex": 86,
      "hip.abd": 6,
      "knee.flex": 78,
      "ankle.dorsi": 18,
      "shoulder.elev": 28,
      "lumbar.flex": 8,
      "thoracic.flex": 8,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest up and avoid excessive lower-back rounding. A modest distributed round at the bottom is the limit.",
      18,
    ),
    checkNeutralNeck("Keep your neck near a neutral position while you brace and pull."),
    checkJointRange(
      "floor-pull",
      "Hips and knees extend from the floor",
      "Drive through your legs and push the floor away, extending your hips and knees until you stand upright.",
      "knee_L.flex",
      48,
    ),
    checkJointWithinAt(
      "hips-above-knees",
      "Hips stay above a squat",
      "More motion should come from your hips than a squat. Your hips stay well above your knees as you grasp the handles.",
      "hip_L.flex",
      "bottom",
      55,
      115,
    ),
    checkJointWithinAt(
      "dead-stop",
      "Handles reach the floor",
      "Let the dumbbells come to a dead stop on the ground before the next rep, with no bounce between reps.",
      "knee_L.flex",
      "bottom",
      55,
      110,
    ),
  ],
});
