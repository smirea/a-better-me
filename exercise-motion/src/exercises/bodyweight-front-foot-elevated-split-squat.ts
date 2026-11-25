import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange } from "../postures";

const ARMS = {
  "shoulder.elev": 8,
  "shoulder.plane": 10,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.y": 1.02,
  "root.pitch": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  ...ARMS,
};

const FRONT_UP = { "hip.flex": 26, "hip.abd": 8, "knee.flex": 24, "ankle.dorsi": 8 };
const REAR_UP = { "hip.flex": 22, "hip.abd": 6, "knee.flex": 40, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 84, "hip.abd": 10, "knee.flex": 96, "ankle.dorsi": 14 };
const REAR_DOWN = { "hip.flex": 16, "hip.abd": 6, "knee.flex": 62, "ankle.dorsi": -6 };

export const spec = buildExerciseSpec({
  id: "bodyweight-front-foot-elevated-split-squat",
  catalogId: "1a25c6f170d88089a605f20d041c21f8",
  name: "Bodyweight Front Foot Elevated Split Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.16,
    surfaceY: 0.1,
    trackKnees: 8,
    box: { height: 0.1, width: 0.46, depth: 0.36, z: 0.22 },
    split: { frontSide: "L", frontZ: 0.2, rearZ: -0.06, rearMode: "toe", rearY: 0.08 },
  },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, {
      ...TRUNK,
      "root.y": 0.82,
      "root.z": 0.06,
      "root.pitch": 10,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack("Once you step back, you can return to keeping your torso in an upright position."),
    checkFeetPlanted(
      "Keep the entire sole of your elevated foot firmly planted on the step.",
      ["L"],
      0.1,
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
      14,
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
