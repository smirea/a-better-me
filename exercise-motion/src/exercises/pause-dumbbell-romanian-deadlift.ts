import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 5,
  "forearm.pron": 20,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "pause-dumbbell-romanian-deadlift",
  catalogId: "29d5c6f170d8800ab8cafa6d1de4f0af",
  name: "Pause Dumbbell Romanian Deadlift",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Pause", "Stand", "Stacked"],
  tempo: { lower: 2.0, bottom: 1.8, raise: 1.5, top: 0.55 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 12, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.1,
      "root.pitch": 60,
      "hip.flex": 80,
      "hip.abd": 2,
      "knee.flex": 18,
      "ankle.dorsi": 2,
      "shoulder.elev": 58,
      "neck.flex": -6,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
    },
  },
  checks: () => [
    checkFlatBack(
      "Pause at the bottom while staying tight, with your chest up and your back flat.",
      16,
    ),
    checkNeutralNeck(
      "Keep your feet fully planted and your neck near a neutral position throughout the set.",
    ),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, with your shins staying vertical.",
      "hip_L.flex",
      52,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "Do not lock your knees. A mild bend happens when you sit your hips back.",
      "knee_L.flex",
      "bottom",
      8,
      32,
    ),
    checkJointWithinAt(
      "pause-depth",
      "Pause below the knees",
      "Hinge until the dumbbells are at least below your knees, then hold that position for about two seconds.",
      "hip_L.flex",
      "bottom",
      62,
      110,
    ),
  ],
});
