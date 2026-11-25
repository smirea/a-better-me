import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "shoulder.elev": 16,
  "shoulder.plane": 18,
  "shoulder.twist": 12,
  "elbow.flex": 26,
  "forearm.pron": 35,
  "wrist.flex": 0,
};

const UPRIGHT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "standing-plate-loaded-machine-calf-raise",
  catalogId: "1ac5c6f170d88080883cf1815a7949f5",
  name: "Standing Plate-Loaded Machine Calf Raise",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Raise", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.35, raise: 1.8, top: 0.4 },
  station: { kind: "calf-station", mode: "standing", stanceX: 0.12, blockY: 0.18 },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["upperBack"],
    offset: [0, 0.03, 0.02],
    forceDir: [0, -1, 0],
    width: 0.38,
    radius: 0.045,
  },
  stiffness: { ankle: 14, knee: 8, hip: 4 },
  extraContacts: { "calf.block": { foot_L: 0.018, foot_R: 0.018 } },
  progress: (body, frame) => anchorPoint(body, frame, "heel_L").y,
  hints: {
    start: { ...UPRIGHT, "ankle.dorsi": 20 },
    end: { ...UPRIGHT, "root.y": 1.05, "ankle.dorsi": -28 },
  },
  checks: () => [
    checkFlatBack("While you lift your body upward through ankle motion, the rest of your body should remain stationary throughout the exercise."),
    checkJointRange(
      "ankle-rom",
      "Full ankle raise",
      "Push through the balls of your feet to raise your heels fully upward while keeping your knees straight and your trunk upright.",
      "ankle_L.dorsi",
      32,
    ),
    checkJointWithinAt(
      "knees-straight-bottom",
      "Knees stay straight in the stretch",
      "Straighten your knees to stand fully upright and receive the weight from the machine.",
      "knee_L.flex",
      "start",
      2,
      16,
    ),
    checkJointWithinAt(
      "knees-straight-top",
      "Knees stay straight at the top",
      "Once you have lifted your heels as high upward as your ankle mobility permits, you have finished the lifting phase.",
      "knee_L.flex",
      "peak",
      2,
      16,
    ),
    checkAnchorTravel(
      "heel-rise",
      "Heels rise",
      "Push through the balls of your feet to raise your heels fully upward.",
      "heel_L",
      "y",
      0.035,
    ),
  ],
});
