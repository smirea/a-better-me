import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low deficit, under 10 cm, so the pull stays a deadlift rather than a squat. */
const DEFICIT = 0.08;

const ARMS = {
  "shoulder.plane": 72,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "deficit-conventional-deadlift",
  catalogId: "1a35c6f170d8809f90f5d4f2e2273493",
  name: "Deficit Conventional Deadlift",
  defaultLoadKg: 45,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Floor", "Stand", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.8, raise: 1.5, top: 0.45 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 8,
    box: { height: DEFICIT, width: 0.5, depth: 0.42, z: 0.04 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8 + DEFICIT, startZ: 0.14, endY: 0.24, endZ: 0.24, arcBulgeZ: 0.08 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.943 + DEFICIT,
      "shoulder.elev": 10,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.7 + DEFICIT,
      "root.z": -0.02,
      "root.pitch": 42,
      "hip.flex": 98,
      "hip.abd": 4,
      "knee.flex": 82,
      "ankle.dorsi": 22,
      "shoulder.elev": 18,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Pick a deficit height that lets you keep your lower back flat at the bottom of the rep.",
      18,
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral as you pull from the deficit."),
    checkJointRange(
      "deeper-hips",
      "Hips travel farther than a floor pull",
      "The deficit increases how far you must hinge and bend your knees to reach the bar.",
      "hip_L.flex",
      60,
    ),
    checkJointWithinAt(
      "deep-knees",
      "Deeper knee bend at the floor",
      "You want a height that still allows you to use a deadlift technique rather than squatting the weight up.",
      "knee_L.flex",
      "bottom",
      60,
      110,
    ),
    checkJointWithinAt(
      "upright-lockout",
      "Finish standing upright",
      "Thrust your hips forward until you are standing fully upright with your chest up and shoulders back.",
      "hip_L.flex",
      "start",
      0,
      20,
    ),
  ],
});
