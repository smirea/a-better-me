import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Overhand grip, arms hanging so the bar stays against the lead leg. */
const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "b-stance-barbell-romanian-deadlift",
  catalogId: "2ee5c6f170d880d98e4fce18a6a6367e",
  name: "B-Stance Barbell Romanian Deadlift",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.7 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 6,
    split: { frontSide: "L", frontZ: 0.04, rearZ: -0.24, rearMode: "toe", rearY: 0.03 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.78, startZ: 0.14, endY: 0.4, endZ: 0.22, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { shank_L: 0.025, shank_R: 0.025, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 10,
      "root.z": 0.0,
      "knee_R.flex": 18,
      "hip_R.flex": 12,
      "ankle_R.dorsi": -8,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.06,
      "root.pitch": 58,
      "hip_L.flex": 78,
      "hip_R.flex": 62,
      "hip.abd": 2,
      "knee_L.flex": 20,
      "knee_R.flex": 32,
      "ankle_L.dorsi": 2,
      "ankle_R.dorsi": -12,
      "shoulder.elev": 52,
      "neck.flex": -6,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
    },
  },
  checks: () => [
    checkFlatBack(
      "Throughout the set, keep your lower back flat, chest up, and lead foot fully planted on the ground.",
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are normally standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "lead-hinge",
      "Lead hip does the hinge",
      "Focus on sitting your lead leg's hip back while letting your rear leg's hip move with it.",
      "hip_L.flex",
      48,
    ),
    checkJointWithinAt(
      "soft-lead-knee",
      "Lead knee bends only mildly",
      "Strive to keep your lead leg's shin vertical, without locking the knee or squatting the weight.",
      "knee_L.flex",
      "bottom",
      4,
      34,
    ),
    checkJointWithinAt(
      "rear-toe",
      "Rear leg stays on the toe",
      "Place the balls and toes of your rear foot on the ground while keeping its heel off the ground.",
      "knee_R.flex",
      "bottom",
      16,
      75,
    ),
  ],
});
