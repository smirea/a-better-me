import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hands inside the knees; the plates only tap the floor. */
const ARMS = {
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "touch-and-go-sumo-deadlift",
  catalogId: "23a5c6f170d880619991ceb9000e3a7f",
  name: "Touch-And-Go Sumo Deadlift",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Tap", "Stand", "Lockout"],
  tempo: { lower: 1.15, bottom: 0.08, raise: 1.05, top: 0.35 },
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
    checkFlatBack("Keep your chest up, back flat, and knees pushed out as the plates tap the floor.", 22),
    checkNeutralNeck("Keep your neck near a neutral position while you stay braced between reps."),
    checkJointRange(
      "sumo-pull",
      "Wide-stance pull off the floor",
      "Spread your legs apart into a wide stance that is clearly outside shoulder width, with your feet moderately rotated out.",
      "knee_L.flex",
      40,
    ),
    checkJointWithinAt(
      "toes-out",
      "Knees stacked over the heels",
      "Push your knees out approximately over your heels, resulting in close to vertical shins.",
      "hip_L.abd",
      "bottom",
      10,
      36,
    ),
    checkJointWithinAt(
      "floor-tap",
      "Deep enough to touch the plates down",
      "Lower the bar until the plates lightly contact the ground, then immediately initiate the next rep.",
      "hip_L.flex",
      "bottom",
      40,
      120,
    ),
  ],
});
