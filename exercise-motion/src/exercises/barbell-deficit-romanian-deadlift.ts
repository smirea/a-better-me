import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low deficit so a flexible hinge can reach closer to the plates. */
const DEFICIT = 0.08;

const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "barbell-deficit-romanian-deadlift",
  catalogId: "1f05c6f170d88048bb62c2359b9bd65d",
  name: "Barbell Deficit Romanian Deadlift",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.3, bottom: 0.25, raise: 1.5, top: 0.65 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 6,
    box: { height: DEFICIT, width: 0.5, depth: 0.42, z: 0.05 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8 + DEFICIT, startZ: 0.12, endY: 0.36, endZ: 0.22, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { shank_L: 0.025, shank_R: 0.025, thigh_L: 0.03, thigh_R: 0.03 } },
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
      "root.y": 0.84 + DEFICIT,
      "root.z": -0.12,
      "root.pitch": 62,
      "hip.flex": 88,
      "hip.abd": 2,
      "knee.flex": 18,
      "ankle.dorsi": 2,
      "shoulder.elev": 60,
      "neck.flex": -8,
      "lumbar.flex": 6,
      "thoracic.flex": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge at your hips with a flat lower back. The deficit asks for more hamstring range than a standard Romanian deadlift.",
      22,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, as when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "deeper-hinge",
      "Deeper hip hinge than a floor RDL",
      "If you can hinge until the plates contact the ground, descend until you can tap the plates very lightly, but do not let the weight rest.",
      "hip_L.flex",
      65,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "Allow your knees to bend mildly while most of the motion comes from your hips.",
      "knee_L.flex",
      "bottom",
      8,
      32,
    ),
    checkJointWithinAt(
      "long-bottom",
      "Hips reach a deep hinge",
      "Selecting a low deficit height (under 4 in) lets you hinge farther while keeping a Romanian deadlift pattern.",
      "hip_L.flex",
      "bottom",
      70,
      120,
    ),
  ],
});
