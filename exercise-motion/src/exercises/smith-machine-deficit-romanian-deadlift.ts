import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low deficit, under 10 cm, so the hinge can travel farther than a floor Smith RDL. */
const DEFICIT = 0.08;

const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-deficit-romanian-deadlift",
  catalogId: "1f15c6f170d880b18270e30e4cd15fcd",
  name: "Smith Machine Deficit Romanian Deadlift",
  defaultLoadKg: 14,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.55 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    toeOutDeg: 6,
    box: { height: DEFICIT, width: 0.5, depth: 0.4, z: 0.04 },
    smith: { stopY: 0.28 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.24,
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
      "root.y": 0.82 + DEFICIT,
      "root.z": -0.1,
      "root.pitch": 62,
      "hip.flex": 84,
      "hip.abd": 2,
      "knee.flex": 18,
      "ankle.dorsi": 2,
      "shoulder.elev": 54,
      "neck.flex": -6,
      "lumbar.flex": 5,
      "thoracic.flex": 6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge with a flat lower back on the low platform. The deficit asks for more hamstring range than a Smith Romanian deadlift from the floor.",
      18,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, as when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "deeper-hinge",
      "Deeper hip hinge from the deficit",
      "The low block lets you sit back farther while the bar stays on the Smith rails.",
      "hip_L.flex",
      60,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "Allow a mild knee bend. Keep the shins close to vertical rather than squatting the bar.",
      "knee_L.flex",
      "bottom",
      8,
      34,
    ),
    checkJointWithinAt(
      "long-bottom",
      "Hips reach a deep hinge",
      "A deficit under 4 inches lets you hinge farther and still keep a Romanian deadlift pattern.",
      "hip_L.flex",
      "bottom",
      70,
      120,
    ),
  ],
});
