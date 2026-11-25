import { ALONG_Z, box, cylinder } from "../equipment";
import { platformBox } from "../equipment-library";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

const MACHINE = [
  ...platformBox("belt.platform", [0, 0, 0.02], 0.78, 0.08, 0.7, "steel"),
  box("belt.post", [0, 0.7, -0.72], [0.08, 1.35, 0.08], "steel", false),
  cylinder("belt.arm", [0, 0.55, -0.28], 0.025, 0.95, "steel", ALONG_Z, false),
];

export const spec = buildExerciseSpec({
  id: "lever-arm-belt-squat-machine-b-stance-romanian-deadlift",
  catalogId: "39b5c6f170d88044b009ea887eadb875",
  name: "Lever-Arm Belt Squat Machine B-Stance Romanian Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.6 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 6,
    surfaceY: 0.08,
    split: { frontSide: "L", frontZ: 0.06, rearZ: -0.16, rearMode: "toe", rearY: 0.08 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.86, startZ: 0.2, endY: 0.44, endZ: 0.28, arcBulgeZ: 0.03 },
  },
  extraEquipment: MACHINE,
  extraContacts: {
    bar: { shank_L: 0.03, shank_R: 0.03 },
    "belt.platform": { foot_L: 0.05, foot_R: 0.06, shank_R: 0.04 },
  },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 1.02,
      "shoulder.elev": 10,
      "knee_R.flex": 16,
      "hip_R.flex": 12,
      "ankle_R.dorsi": -10,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.92,
      "root.z": -0.06,
      "root.pitch": 56,
      "hip_L.flex": 76,
      "hip_R.flex": 58,
      "knee_L.flex": 20,
      "knee_R.flex": 30,
      "ankle_L.dorsi": 2,
      "ankle_R.dorsi": -14,
      "shoulder.elev": 54,
      "neck.flex": -6,
      "lumbar.flex": 4,
      "thoracic.flex": 5,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat, chest up, and lead foot fully planted on the platform.",
      16,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, as when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "lead-hinge",
      "Lead hip does the hinge",
      "Bear almost all of your weight through the lead foot and sit that hip back.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "soft-lead-knee",
      "Lead shin stays near vertical",
      "Keep the lead knee softly bent, with weight through the whole lead foot rather than only the heel or the toes.",
      "knee_L.flex",
      "bottom",
      6,
      34,
    ),
    checkJointWithinAt(
      "rear-toe",
      "Rear foot stays on the toe",
      "Place the balls and toes of the rear foot on the platform and keep the heel up.",
      "knee_R.flex",
      "bottom",
      14,
      70,
    ),
  ],
});
