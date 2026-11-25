import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Snatch-width hands, soft knees, bar stays against the legs through the hinge. */
const ARMS = {
  "shoulder.plane": 30,
  "shoulder.twist": 8,
  "elbow.flex": 5,
  "forearm.pron": 74,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "snatch-grip-romanian-deadlift",
  catalogId: "29d5c6f170d880409366c2590701e800",
  name: "Snatch Grip Romanian Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.65 },
  station: { kind: "standing", stanceX: 0.13, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.46,
    path: { startY: 0.86, startZ: 0.1, endY: 0.42, endZ: 0.22, arcBulgeZ: 0.04 },
  },
  extraContacts: { bar: { shank_L: 0.025, shank_R: 0.025, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 42, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.84,
      "root.z": -0.1,
      "root.pitch": 68,
      "hip.flex": 86,
      "hip.abd": 2,
      "knee.flex": 16,
      "ankle.dorsi": 2,
      "shoulder.elev": 70,
      "neck.flex": -6,
      "lumbar.flex": 2,
      "thoracic.flex": 4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Sit your buttocks backward to hinge at your hips as you keep your lower back flat, chest up, and core braced.",
    ),
    checkNeutralNeck("Keep the soles of your feet fully planted and your neck near a neutral position."),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, and your shins should remain in a vertical position throughout your set.",
      "hip_L.flex",
      55,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "You should not keep your knees fully straightened. The mild knee bend can naturally occur when you sit your buttocks backward.",
      "knee_L.flex",
      "bottom",
      6,
      30,
    ),
    checkJointWithinAt(
      "snatch-width",
      "Arms stay spread wide",
      "With straight elbows, spread your arms apart until each arm forms close to a 45-degree angle with your torso.",
      "shoulder_L.elev",
      "start",
      28,
      75,
    ),
  ],
});
