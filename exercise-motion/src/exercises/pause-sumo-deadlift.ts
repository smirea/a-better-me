import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pause just after the plates leave the floor, in a wide toes-out stance. */
const ARMS = {
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "pause-sumo-deadlift",
  catalogId: "1a35c6f170d880548e7ec4399baa5441",
  name: "Pause Sumo Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pause", "Stand", "Lockout"],
  tempo: { lower: 1.3, bottom: 1.6, raise: 1.2, top: 0.4 },
  station: { kind: "standing", stanceX: 0.24, toeOutDeg: 28, balanceZ: 0.06 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.14,
    path: { startY: 0.72, startZ: 0.18, endY: 0.52, endZ: 0.24, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { shank_L: 0.04, shank_R: 0.04, thigh_L: 0.04, thigh_R: 0.04 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 8,
      "hip.abd": 14,
      "hip.rot": 12,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": 0.0,
      "root.pitch": 14,
      "hip.flex": 36,
      "hip.abd": 14,
      "hip.rot": 10,
      "knee.flex": 32,
      "ankle.dorsi": 18,
      "ankle.inv": 4,
      "shoulder.elev": 14,
      "lumbar.flex": 6,
      "thoracic.flex": 10,
      "neck.flex": -2,
    },
  },
  checks: () => [
    checkFlatBack(
      "Just after the plates lift off the floor, pause while staying tight with your chest up and back flat.",
      18,
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral through the pause."),
    checkJointRange(
      "sumo-pull",
      "Wide-stance pull off the floor",
      "Spread your legs apart into a wide stance that is clearly outside shoulder width, with your feet moderately rotated out.",
      "knee_L.flex",
      18,
    ),
    checkJointWithinAt(
      "just-off-floor",
      "Pause with the knees still bent",
      "Pause in that position for a brief period of time (e.g., 1-2 seconds) while staying tight.",
      "knee_L.flex",
      "bottom",
      20,
      70,
    ),
    checkJointWithinAt(
      "toes-out",
      "Hips stay open",
      "Push your knees out approximately over your heels, resulting in close to vertical shins.",
      "hip_L.abd",
      "bottom",
      12,
      40,
    ),
  ],
});
