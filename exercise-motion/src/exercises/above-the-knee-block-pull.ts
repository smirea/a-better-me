import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Tall blocks under full-size plates put the bar just above the knee. */
const BLOCK_H = 0.34;
const BAR_Y = 0.225 + BLOCK_H;

const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "above-the-knee-block-pull",
  catalogId: "2345c6f170d88028a336fb2275d7dbdc",
  name: "Above-The-Knee Block Pull",
  defaultLoadKg: 52,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Blocks", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.85, raise: 1.2, top: 0.45 },
  station: { kind: "standing", stanceX: 0.13, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.78, startZ: 0.14, endY: BAR_Y, endZ: 0.2, arcBulgeZ: 0.03 },
  },
  extraEquipment: [
    ...platformBox("block.L", [0.78, 0, 0.1], 0.46, BLOCK_H, 0.4),
    ...platformBox("block.R", [-0.78, 0, 0.1], 0.46, BLOCK_H, 0.4),
  ],
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "hip.abd": 4, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.88,
      "root.z": -0.08,
      "root.pitch": 42,
      "hip.flex": 56,
      "hip.abd": 4,
      "knee.flex": 18,
      "ankle.dorsi": 4,
      "shoulder.elev": 16,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back looking flat near a neutral position rather than excessively rounding it as you pull from the blocks.",
      14,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkJointRange(
      "short-pull",
      "Short pull off the blocks",
      "Immediately after the bar begins lifting, thrust your hips forward until you are standing fully upright.",
      "hip_L.flex",
      28,
    ),
    checkJointWithinAt(
      "above-knee",
      "Knees stay nearly straight",
      "The blocks situate the bar slightly above your knees, so your shins stay essentially vertical.",
      "knee_L.flex",
      "bottom",
      8,
      32,
    ),
    checkJointWithinAt(
      "hip-dominant",
      "Most of the motion is the hips",
      "More motion should come from your hips than your knees as you descend to the blocks.",
      "hip_L.flex",
      "bottom",
      38,
      85,
    ),
  ],
});
