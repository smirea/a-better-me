import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide stance, toes out, hands inside the knees, plates dead-stopped on the floor. */
const ARMS = {
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "sumo-deadlift",
  catalogId: "1a35c6f170d8807aae84e2c6eb136395",
  name: "Sumo Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Floor", "Stand", "Lockout"],
  tempo: { lower: 1.5, bottom: 0.8, raise: 1.25, top: 0.4 },
  station: { kind: "standing", stanceX: 0.22, toeOutDeg: 24, balanceZ: 0.04 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.18,
    path: { startY: 0.8, startZ: 0.16, endY: 0.26, endZ: 0.24, arcBulgeZ: 0.06 },
  },
  extraContacts: { bar: { shank_L: 0.04, shank_R: 0.04, thigh_L: 0.04, thigh_R: 0.04 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 8,
      "hip.abd": 10,
      "hip.rot": 8,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.76,
      "root.z": -0.02,
      "root.pitch": 32,
      "hip.flex": 72,
      "hip.abd": 12,
      "hip.rot": 8,
      "knee.flex": 68,
      "ankle.dorsi": 16,
      "ankle.inv": 4,
      "shoulder.elev": 16,
      "lumbar.flex": 4,
      "thoracic.flex": 8,
      "neck.flex": -2,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and chest up in a proud chest posture rather than rounding your back.",
      22,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkJointRange(
      "sumo-pull",
      "Wide-stance pull off the floor",
      "Spread your legs apart into a wide stance that is clearly outside shoulder width, with your toes moderately rotated out.",
      "knee_L.flex",
      40,
    ),
    checkJointWithinAt(
      "floor-stop",
      "Plates rest on the floor",
      "Allow the weight to come to a dead stop on the ground for a moment rather than simply tapping the ground.",
      "hip_L.flex",
      "bottom",
      40,
      120,
    ),
    checkJointWithinAt(
      "knees-out",
      "Knees stacked over the heels",
      "Try to push your knees far enough out to the sides that they are vertically stacked over your heels.",
      "hip_L.abd",
      "bottom",
      10,
      36,
    ),
  ],
});
