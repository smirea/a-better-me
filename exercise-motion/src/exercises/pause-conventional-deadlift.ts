import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * The catalog pause is just below the knees, near mid-shin, not on the floor.
 * `tempo.bottom` holds that position for about 1.5 seconds.
 */
const ARMS = {
  "shoulder.plane": 74,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "pause-conventional-deadlift",
  catalogId: "1a35c6f170d880d697d3f111b6bd16f5",
  name: "Pause Conventional Deadlift",
  defaultLoadKg: 45,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pause", "Stand", "Lockout"],
  tempo: { lower: 1.4, bottom: 1.6, raise: 1.2, top: 0.4 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8, startZ: 0.12, endY: 0.42, endZ: 0.18, arcBulgeZ: 0.04 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.82,
      "root.z": -0.06,
      "root.pitch": 48,
      "hip.flex": 68,
      "hip.abd": 4,
      "knee.flex": 38,
      "ankle.dorsi": 10,
      "shoulder.elev": 28,
      "lumbar.flex": 6,
      "thoracic.flex": 10,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Pause in that position while staying tight with your chest up and back flat.",
      20,
    ),
    checkNeutralNeck("Stay tight with your chest up and your neck near neutral during the pause."),
    checkJointRange(
      "partial-pull",
      "Bar travels to mid-shin",
      "After the bar reaches near the middle of your shins, pause in that position for a brief period of time.",
      "hip_L.flex",
      40,
    ),
    checkJointWithinAt(
      "mid-shin-pause",
      "Pause with the hips still flexed",
      "Avoid rushing your pause to the best of your ability as you visibly remain stationary.",
      "hip_L.flex",
      "bottom",
      45,
      100,
    ),
    checkJointWithinAt(
      "soft-lockout",
      "Finish by standing upright",
      "Following the pause, thrust your hips forward until you are standing fully upright with your chest up and shoulders back.",
      "knee_L.flex",
      "start",
      0,
      22,
    ),
  ],
});
