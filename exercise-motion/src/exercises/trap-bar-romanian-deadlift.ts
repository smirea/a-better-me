import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low handles so the hinge can pass the knees. Neutral grip beside the thighs. */
const ARMS = {
  "shoulder.plane": 18,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "trap-bar-romanian-deadlift",
  catalogId: "2ee5c6f170d8809a9e87d7a58d087ca3",
  name: "Trap Bar Romanian Deadlift",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.7 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 10 },
  apparatus: {
    kind: "barbell",
    style: "trap",
    gripX: 0.31,
    alignWrists: false,
    path: { startY: 0.78, startZ: 0.08, endY: 0.42, endZ: 0.14, arcBulgeZ: 0.04 },
  },
  extraContacts: { bar: { thigh_L: 0.04, thigh_R: 0.04, shank_L: 0.04, shank_R: 0.04 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 8, "hip.flex": 8, "hip.abd": 6, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.08,
      "root.pitch": 58,
      "hip.flex": 80,
      "hip.abd": 6,
      "knee.flex": 20,
      "ankle.dorsi": 4,
      "shoulder.elev": 16,
      "neck.flex": -4,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
    },
  },
  checks: () => [
    checkFlatBack(
      "Sit your hips backward while bending your knees mildly as you keep your lower back flat, chest up, and core braced.",
    ),
    checkNeutralNeck(
      "Throughout the set, keep your neck near a neutral position, like when you are normally standing upright.",
    ),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, and your shins should remain vertical throughout your set.",
      "hip_L.flex",
      50,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "Do not keep your knees fully straight. The mild knee bend occurs when you sit your buttocks backward.",
      "knee_L.flex",
      "bottom",
      8,
      34,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip on the handles",
      "Grasp the handles beside your thighs with your palms facing each other.",
      "forearm_L.pron",
      "bottom",
      -25,
      25,
    ),
  ],
});
