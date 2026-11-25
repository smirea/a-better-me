import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Plates sit on low blocks, so the bar starts above a floor pull. */
const BLOCK_H = 0.08;
const BAR_BOTTOM = 0.225 + BLOCK_H;

const ARMS = {
  "shoulder.plane": 75,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "conventional-low-block-pull",
  catalogId: "1a35c6f170d880349a3beab3040acdc9",
  name: "Conventional Low Block Pull",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Blocks", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.9, raise: 1.4, top: 0.45 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8, startZ: 0.14, endY: BAR_BOTTOM, endZ: 0.24, arcBulgeZ: 0.08 },
  },
  extraEquipment: [
    ...platformBox("block.L", [0.78, 0, 0.1], 0.48, BLOCK_H, 0.48),
    ...platformBox("block.R", [-0.78, 0, 0.1], 0.48, BLOCK_H, 0.48),
  ],
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.78,
      "root.z": -0.04,
      "root.pitch": 38,
      "hip.flex": 72,
      "hip.abd": 4,
      "knee.flex": 52,
      "ankle.dorsi": 16,
      "shoulder.elev": 22,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and your chest up rather than rounding your back as you pull from the blocks.",
      18,
    ),
    checkNeutralNeck("Keep your neck near a neutral position while your chest stays up."),
    checkJointRange(
      "hip-drive",
      "Hips and knees extend together",
      "Drive through your legs to begin lifting the bar before thrusting your hips forward to stand upright.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "shallower-than-floor",
      "Knees bend less than a floor pull",
      "The blocks shorten the pull, so you do not have to sink as deep as a deadlift from the floor.",
      "knee_L.flex",
      "bottom",
      30,
      90,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your elbows straight and the bar very close to your legs as you lift the bar.",
      "elbow_L.flex",
      "start",
      0,
      18,
    ),
  ],
});
