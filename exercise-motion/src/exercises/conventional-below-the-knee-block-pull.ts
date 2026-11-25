import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** ~8 in blocks under full-size plates put the bar a little below the knee. */
const BLOCK_H = 0.2;
const BAR_Y = 0.225 + BLOCK_H;

const ARMS = {
  "shoulder.plane": 76,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "conventional-below-the-knee-block-pull",
  catalogId: "2335c6f170d8800da97ad86a1eddbe37",
  name: "Conventional Below-The-Knee Block Pull",
  defaultLoadKg: 44,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Blocks", "Stand", "Lockout"],
  tempo: { lower: 1.7, bottom: 0.9, raise: 1.3, top: 0.45 },
  station: { kind: "standing", stanceX: 0.13, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.78, startZ: 0.14, endY: BAR_Y, endZ: 0.22, arcBulgeZ: 0.05 },
  },
  extraEquipment: [
    ...platformBox("block.L", [0.78, 0, 0.12], 0.48, BLOCK_H, 0.42),
    ...platformBox("block.R", [-0.78, 0, 0.12], 0.48, BLOCK_H, 0.42),
  ],
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "hip.abd": 4, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.82,
      "root.z": -0.06,
      "root.pitch": 48,
      "hip.flex": 70,
      "hip.abd": 4,
      "knee.flex": 34,
      "ankle.dorsi": 8,
      "shoulder.elev": 22,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and your chest up rather than rounding your back as you pull from the blocks.",
      16,
    ),
    checkNeutralNeck("Keep your neck near a neutral position while your chest stays up."),
    checkJointRange(
      "hip-drive",
      "Hips and knees extend together",
      "Drive through your legs to begin lifting the bar before thrusting your hips forward to stand upright.",
      "hip_L.flex",
      40,
    ),
    checkJointWithinAt(
      "below-knee",
      "Bar starts a little below the knee",
      "The blocks situate the bar close to slightly below your knees, so you do not sink as deep as a floor pull.",
      "knee_L.flex",
      "bottom",
      16,
      52,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Your arms should be directed straight down such that they form approximately 90-degree angles with the bar.",
      "elbow_L.flex",
      "start",
      0,
      18,
    ),
  ],
});
