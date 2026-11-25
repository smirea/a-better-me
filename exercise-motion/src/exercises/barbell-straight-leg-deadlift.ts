import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Knees stay nearly straight, so the bar swings farther in front of the legs as the hips hinge. */
const ARMS = {
  "shoulder.plane": 88,
  "shoulder.twist": 10,
  "elbow.flex": 4,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "barbell-straight-leg-deadlift",
  catalogId: "1f15c6f170d8804d99b1d1aedad699ce",
  name: "Barbell Straight-Leg Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 4 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.78, startZ: 0.14, endY: 0.42, endZ: 0.36, arcBulgeZ: 0.06 },
  },
  extraContacts: { bar: { thigh_L: 0.04, thigh_R: 0.04 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 12, "knee.flex": 4, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.9,
      "root.z": -0.12,
      "root.pitch": 70,
      "hip.flex": 84,
      "hip.abd": 2,
      "knee.flex": 6,
      "ankle.dorsi": 0,
      "shoulder.elev": 48,
      "neck.flex": -6,
      "lumbar.flex": 2,
      "thoracic.flex": 4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your elbows straightened, core braced, and lower back near a neutral position while you hinge.",
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are standing upright and looking straight ahead."),
    checkJointRange(
      "hip-only",
      "Essentially all of the motion comes from the hips",
      "You should be able to draw a straight line from your thigh through your knee to your lower leg, as your knees do not move.",
      "hip_L.flex",
      55,
    ),
    checkJointWithinAt(
      "straight-knees",
      "Knees stay nearly straight",
      "Keep your knees straightened but not fully locked out while you hinge at your hips.",
      "knee_L.flex",
      "bottom",
      0,
      14,
    ),
    checkJointWithinAt(
      "torso-down",
      "Torso approaches horizontal",
      "Hinge at your hips through your available range so your torso transitions to an angle that is closer to horizontal.",
      "hip_L.flex",
      "bottom",
      60,
      110,
    ),
  ],
});
