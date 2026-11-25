import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Same hinge as a Romanian deadlift, held still below the knees. */
const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "pause-barbell-romanian-deadlift",
  catalogId: "29d5c6f170d8802888dff17fa2dbe04b",
  name: "Pause Barbell Romanian Deadlift",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Pause", "Stand", "Stacked"],
  tempo: { lower: 2.0, bottom: 1.8, raise: 1.5, top: 0.55 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8, startZ: 0.12, endY: 0.4, endZ: 0.2, arcBulgeZ: 0.035 },
  },
  extraContacts: { bar: { shank_L: 0.025, shank_R: 0.025, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.88,
      "root.z": -0.1,
      "root.pitch": 62,
      "hip.flex": 82,
      "hip.abd": 2,
      "knee.flex": 18,
      "ankle.dorsi": 2,
      "shoulder.elev": 58,
      "neck.flex": -6,
      "lumbar.flex": 2,
      "thoracic.flex": 4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Pause in the bottom position while staying tight with your chest up and back flat.",
      18,
    ),
    checkNeutralNeck(
      "Throughout the set, keep your feet fully planted on the ground and your neck near a neutral position.",
    ),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, and your shins should remain vertical throughout your set.",
      "hip_L.flex",
      55,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "Do not keep your knees fully straight. The appropriately mild degree of knee bend can naturally occur when you sit your buttocks backward.",
      "knee_L.flex",
      "bottom",
      8,
      32,
    ),
    checkJointWithinAt(
      "below-knees",
      "Pause below the knees",
      "Lifters with normal flexibility can typically lower the bar at least below their knees, then pause there.",
      "hip_L.flex",
      "bottom",
      65,
      110,
    ),
  ],
});
