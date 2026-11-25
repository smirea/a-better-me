import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { platformBox } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low blocks lift full-size plates about 1.5 in off the floor. */
const BLOCK_H = 0.04;
const BAR_Y = 0.225 + BLOCK_H;

const ARMS = {
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "sumo-low-block-pull",
  catalogId: "2395c6f170d8800dbd1ac184188c0ee5",
  name: "Sumo Low Block Pull",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Blocks", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.9, raise: 1.3, top: 0.45 },
  station: { kind: "standing", stanceX: 0.28, toeOutDeg: 28, balanceZ: 0.04 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.16,
    path: { startY: 0.74, startZ: 0.16, endY: BAR_Y, endZ: 0.22, arcBulgeZ: 0.03 },
  },
  extraEquipment: [
    ...platformBox("block.L", [0.8, 0, 0.18], 0.46, BLOCK_H, 0.36),
    ...platformBox("block.R", [-0.8, 0, 0.18], 0.46, BLOCK_H, 0.36),
  ],
  extraContacts: { bar: { shank_L: 0.04, shank_R: 0.04, thigh_L: 0.04, thigh_R: 0.04 } },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "shoulder.elev": 8,
      "hip.abd": 16,
      "hip.rot": 12,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.72,
      "root.z": -0.02,
      "root.pitch": 28,
      "hip.flex": 62,
      "hip.abd": 18,
      "hip.rot": 12,
      "knee.flex": 58,
      "ankle.dorsi": 18,
      "ankle.inv": 4,
      "shoulder.elev": 16,
      "lumbar.flex": 5,
      "thoracic.flex": 8,
      "neck.flex": -2,
    },
  },
  checks: () => [
    checkFlatBack("Keep your chest up, back flat, and knees pushed out as you pull from the low blocks.", 18),
    checkNeutralNeck("Keep your neck near neutral while your chest stays up."),
    checkJointRange(
      "sumo-pull",
      "Wide-stance pull off low blocks",
      "Spread your legs apart into a wide stance that is clearly outside shoulder width, with your feet moderately rotated out.",
      "knee_L.flex",
      30,
    ),
    checkJointWithinAt(
      "knees-out",
      "Knees stay stacked over the heels",
      "Push your knees out approximately over your heels, resulting in close to vertical shins.",
      "hip_L.abd",
      "bottom",
      12,
      40,
    ),
    checkJointWithinAt(
      "narrow-grip",
      "Arms hang inside the stance",
      "Grasp the bar with straight elbows between your legs.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
  ],
});
