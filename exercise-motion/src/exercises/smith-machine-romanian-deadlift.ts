import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-romanian-deadlift",
  catalogId: "1a35c6f170d880e3a844c5b35bb2ad0b",
  name: "Smith Machine Romanian Deadlift",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.1, bottom: 0.25, raise: 1.5, top: 0.55 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6, smith: { stopY: 0.32 } },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.24,
  },
  extraContacts: { bar: { shank_L: 0.025, shank_R: 0.025, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.08,
      "root.pitch": 60,
      "hip.flex": 80,
      "hip.abd": 2,
      "knee.flex": 18,
      "ankle.dorsi": 2,
      "shoulder.elev": 52,
      "neck.flex": -6,
      "lumbar.flex": 4,
      "thoracic.flex": 5,
    },
  },
  checks: () => [
    checkFlatBack(
      "Sit your hips back with a flat lower back and the bar staying close to your legs on the rails.",
      16,
    ),
    checkNeutralNeck(
      "Keep your feet planted and your neck near a neutral position, as when you are standing and looking ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, with your shins staying vertical.",
      "hip_L.flex",
      50,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "Do not lock your knees. A mild bend happens when you sit your hips back.",
      "knee_L.flex",
      "bottom",
      8,
      34,
    ),
    checkJointWithinAt(
      "below-knees",
      "Bar lowers below the knees",
      "With normal flexibility the bar travels at least below the knees. Tap the bottom stops lightly if you reach them, and do not rest there.",
      "hip_L.flex",
      "bottom",
      62,
      110,
    ),
  ],
});
