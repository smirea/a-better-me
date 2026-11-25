import { ALONG_Z, box, cylinder } from "../equipment";
import { platformBox } from "../equipment-library";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Overhand grip on the lever's straight-bar attachment. */
const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 12,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

/** Lever post behind the lifter and a low platform under the feet. The bar attachment is the moving load. */
const MACHINE = [
  ...platformBox("belt.platform", [0, 0, 0.06], 0.72, 0.08, 0.62, "steel"),
  box("belt.post", [0, 0.7, -0.72], [0.08, 1.35, 0.08], "steel", false),
  box("belt.horn", [0, 0.28, -0.55], [0.06, 0.06, 0.28], "steel", false),
  cylinder("belt.arm", [0, 0.55, -0.28], 0.025, 0.95, "steel", ALONG_Z, false),
];

export const spec = buildExerciseSpec({
  id: "lever-arm-belt-squat-machine-romanian-deadlift",
  catalogId: "32f5c6f170d8802b8047cd9bb83fae59",
  name: "Lever-Arm Belt Squat Machine Romanian Deadlift",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Below knees", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6, surfaceY: 0.08 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.86, startZ: 0.18, endY: 0.42, endZ: 0.26, arcBulgeZ: 0.03 },
  },
  extraEquipment: MACHINE,
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 1.02,
      "shoulder.elev": 10,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.92,
      "root.z": -0.08,
      "root.pitch": 60,
      "hip.flex": 80,
      "hip.abd": 2,
      "knee.flex": 18,
      "ankle.dorsi": 2,
      "shoulder.elev": 56,
      "neck.flex": -6,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge with a flat lower back and a braced core. The lever lets you sit back without holding a free barbell.",
      16,
    ),
    checkNeutralNeck(
      "Keep your feet planted on the platform and your neck near a neutral position, as when you are standing and looking ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Motion comes from the hips",
      "Most of the motion should come from your hips, with your shins staying vertical.",
      "hip_L.flex",
      50,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees bend only mildly",
      "Let the knees bend mildly as you sit back. Do not turn the rep into a squat.",
      "knee_L.flex",
      "bottom",
      8,
      34,
    ),
    checkJointWithinAt(
      "below-knees",
      "Bar lowers below the knees",
      "With normal flexibility the attachment travels at least below the knees before you stand back up.",
      "hip_L.flex",
      "bottom",
      62,
      110,
    ),
  ],
});
