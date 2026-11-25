import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Narrow grip inside a wide toes-out stance, arms hanging so the bar stays in front of the thighs. */
const ARMS = {
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "sumo-romanian-deadlift",
  catalogId: "23a5c6f170d8803da1bcf5b34ea5423d",
  name: "Sumo Romanian Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.1, bottom: 0.25, raise: 1.5, top: 0.65 },
  station: { kind: "standing", stanceX: 0.24, toeOutDeg: 30, balanceZ: 0.06 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.14,
    path: { startY: 0.74, startZ: 0.18, endY: 0.42, endZ: 0.24, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.035, thigh_R: 0.035 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 8,
      "hip.abd": 14,
      "hip.rot": 10,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.88,
      "root.z": -0.06,
      "root.pitch": 46,
      "hip.flex": 70,
      "hip.abd": 14,
      "hip.rot": 10,
      "knee.flex": 18,
      "ankle.dorsi": 4,
      "ankle.inv": 4,
      "shoulder.elev": 32,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge at your hips in a controlled manner as you keep your lower back near a neutral position.",
      22,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally standing upright."),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, and your shins should remain in a vertical position throughout your set.",
      "hip_L.flex",
      50,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "You should not keep your knees fully straightened. The appropriately mild degree of knee bend can naturally occur when you sit back.",
      "knee_L.flex",
      "bottom",
      8,
      32,
    ),
    checkJointWithinAt(
      "wide-stance",
      "Hips stay open",
      "A sumo Romanian deadlift begins in the fully upright position of a sumo deadlift, with the feet clearly outside shoulder width.",
      "hip_L.abd",
      "bottom",
      10,
      36,
    ),
  ],
});
