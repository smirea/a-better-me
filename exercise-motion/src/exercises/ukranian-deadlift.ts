import { platformBox } from "../equipment-library";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Ukrainian (also spelled Ukranian in the catalog) deadlift: wide stance on two boxes,
 * kettlebell hanging in the gap so the hips and knees can travel deeper than a floor pull.
 */
const BOX_H = 0.22;

const ARMS = {
  "shoulder.plane": 28,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "ukranian-deadlift",
  catalogId: "3015c6f170d8800e9031f437108c44ff",
  name: "Ukranian Deadlift",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Deep", "Stand", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.45, raise: 1.4, top: 0.4 },
  station: { kind: "standing", stanceX: 0.34, toeOutDeg: 24, surfaceY: BOX_H, balanceZ: 0.08 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  extraEquipment: [
    ...platformBox("ukr.boxL", [0.46, 0, 0.04], 0.4, BOX_H, 0.48),
    ...platformBox("ukr.boxR", [-0.46, 0, 0.04], 0.4, BOX_H, 0.48),
  ],
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.943 + BOX_H,
      "root.z": 0.02,
      "hip.abd": 16,
      "hip.rot": 10,
      "shoulder.elev": 14,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.62 + BOX_H,
      "root.z": -0.02,
      "root.pitch": 38,
      "hip.flex": 92,
      "hip.abd": 22,
      "hip.rot": 8,
      "knee.flex": 96,
      "ankle.dorsi": 22,
      "shoulder.elev": 36,
      "lumbar.flex": 6,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest up and your back tight while the kettlebell hangs between the boxes.",
      16,
    ),
    checkNeutralNeck("Look ahead with your neck near neutral as you stand up between the boxes."),
    checkJointRange(
      "deep-pull",
      "Hips and knees open from a deep deficit",
      "Stand on the boxes and pull the weight from the gap, extending the hips and knees together.",
      "knee_L.flex",
      55,
    ),
    checkJointWithinAt(
      "wide-knees",
      "Knees travel out over a wide stance",
      "Use a wide stance with the toes turned out so the knees track over the feet on each box.",
      "hip_L.abd",
      "bottom",
      10,
      40,
    ),
    checkJointWithinAt(
      "deep-hips",
      "Hips drop into the extra range",
      "The gap between the boxes lets the hips and knees flex deeper than a kettlebell deadlift from the floor.",
      "hip_L.flex",
      "bottom",
      70,
      120,
    ),
  ],
});
