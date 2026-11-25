import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plates sit on blocks, so the handles start above a floor pull. */
const BLOCK_H = 0.18;
const BAR_BOTTOM = 0.225 + BLOCK_H;

const ARMS = {
  "shoulder.plane": 14,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "trap-bar-block-pull",
  catalogId: "1e25c6f170d8809193e0e6ead5da5816",
  name: "Trap Bar Block Pull",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Blocks", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.9, raise: 1.35, top: 0.45 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 10 },
  apparatus: {
    kind: "barbell",
    style: "trap",
    gripX: 0.31,
    alignWrists: false,
    path: { startY: 0.78, startZ: 0.06, endY: BAR_BOTTOM, endZ: 0.1, arcBulgeZ: 0.04 },
  },
  extraEquipment: [
    ...platformBox("block.L", [0.55, 0, 0.08], 0.42, BLOCK_H, 0.42),
    ...platformBox("block.R", [-0.55, 0, 0.08], 0.42, BLOCK_H, 0.42),
  ],
  extraContacts: { bar: { thigh_L: 0.04, thigh_R: 0.04, shank_L: 0.04, shank_R: 0.04 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 8, "hip.abd": 8 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.84,
      "root.z": -0.02,
      "root.pitch": 26,
      "hip.flex": 52,
      "hip.abd": 8,
      "knee.flex": 40,
      "ankle.dorsi": 12,
      "shoulder.elev": 16,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
      "neck.flex": -2,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and chest up rather than rounding your back as you pull from the blocks.",
      16,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkJointRange(
      "block-pull",
      "Hips and knees extend from the blocks",
      "Drive through your legs to begin lifting the bar while extending your hips and knees until you are standing fully upright.",
      "hip_L.flex",
      40,
    ),
    checkJointWithinAt(
      "elevated-start",
      "Shallower than a floor pull",
      "Use a block height that positions the handles at least below your knees, shorter than a pull from the floor.",
      "knee_L.flex",
      "bottom",
      25,
      100,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Firmly grasp the center of the handles with your palms facing in toward each other.",
      "forearm_L.pron",
      "start",
      -25,
      25,
    ),
  ],
});
