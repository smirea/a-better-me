import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const HANG = {
  "shoulder.elev": 8,
  "shoulder.plane": 32,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.y": 1.02,
  "root.pitch": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 6,
  ...HANG,
};

const FRONT_UP = { "hip.flex": 26, "hip.abd": 8, "knee.flex": 24, "ankle.dorsi": 8 };
const REAR_UP = { "hip.flex": 32, "hip.abd": 12, "knee.flex": 36, "ankle.dorsi": -4 };
const FRONT_DOWN = { "hip.flex": 80, "hip.abd": 12, "knee.flex": 90, "ankle.dorsi": 12 };
const REAR_DOWN = { "hip.flex": 8, "hip.abd": 10, "knee.flex": 48, "ankle.dorsi": -4 };

export const spec = buildExerciseSpec({
  id: "offset-kettlebell-front-foot-elevated-split-squat",
  catalogId: "2025c6f170d88055a8f0f470ac301e5b",
  name: "Offset Kettlebell Front Foot Elevated Split Squat",
  defaultLoadKg: 2,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.2,
    surfaceY: 0.12,
    trackKnees: 10,
    box: { height: 0.12, width: 0.5, depth: 0.44, z: 0.34 },
    split: { frontSide: "L", frontZ: 0.22, rearZ: -0.12, rearMode: "toe", rearY: 0.06 },
  },
  apparatus: { kind: "kettlebells", sides: ["R"], hangVertical: true },
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, {
      ...TRUNK,
      "root.y": 0.82,
      "root.z": 0.08,
      "root.pitch": 12,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack(
      "Once you step back, you can return to keeping your torso in an upright position.",
    ),
    checkFeetPlanted(
      "Keep the entire sole of your elevated foot firmly planted on the step.",
      ["L"],
      0.12,
    ),
    checkJointRange(
      "front-knee",
      "Front thigh nears parallel",
      "At the end of the lowering phase, your front leg’s thigh should be close to parallel to the ground.",
      "knee_L.flex",
      40,
    ),
    checkJointRange(
      "rear-knee",
      "Rear knee descends to a tap",
      "Lower your body until you are able to tap the ground gently with the kneecap of your rear leg.",
      "knee_R.flex",
      12,
    ),
    checkJointWithinAt(
      "offset-arm",
      "Kettlebell hangs at the side",
      "Continue holding the kettlebell by your side as your arm is directed down toward the ground.",
      "elbow_R.flex",
      "bottom",
      0,
      24,
    ),
    checkAnchorTravel(
      "depth",
      "Elevated split squat lowers",
      "From your split stance position, allow your knees to bend as you lower your body in a controlled manner.",
      "pelvisBottom",
      "y",
      0.1,
    ),
  ],
});
