import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 5,
  "forearm.pron": 45,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "b-stance-dumbbell-romanian-deadlift",
  catalogId: "2ee5c6f170d880c899dcdd917b32d865",
  name: "B-Stance Dumbbell Romanian Deadlift",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.65 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 6,
    split: { frontSide: "L", frontZ: 0.04, rearZ: -0.22, rearMode: "toe", rearY: 0.02 },
  },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 12,
      "root.z": 0.0,
      "knee_R.flex": 16,
      "hip_R.flex": 12,
      "ankle_R.dorsi": -8,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.08,
      "root.pitch": 58,
      "hip_L.flex": 76,
      "hip_R.flex": 58,
      "hip.abd": 2,
      "knee_L.flex": 20,
      "knee_R.flex": 30,
      "ankle_L.dorsi": 2,
      "ankle_R.dorsi": -12,
      "shoulder.elev": 54,
      "neck.flex": -6,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
    },
  },
  checks: () => [
    checkFlatBack(
      "Throughout the set, keep your lower back flat, chest up, and lead foot fully planted.",
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, as when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "lead-hinge",
      "Lead hip does the hinge",
      "Focus on sitting your lead leg's hip back while the rear leg only helps you balance.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "soft-lead-knee",
      "Lead knee bends only mildly",
      "Keep the lead shin close to vertical, without locking the knee or squatting the dumbbells.",
      "knee_L.flex",
      "bottom",
      6,
      34,
    ),
    checkJointWithinAt(
      "rear-toe",
      "Rear foot stays on the toe",
      "Place the balls and toes of your rear foot on the ground while keeping the heel up.",
      "knee_R.flex",
      "bottom",
      14,
      70,
    ),
  ],
});
