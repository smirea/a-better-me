import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "shoulder.elev": 8,
  "shoulder.plane": 8,
  "elbow.flex": 6,
  "forearm.pron": 10,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": 1,
  "thoracic.flex": 0,
  "neck.flex": 4,
  ...ARMS,
};

const FRONT_UP = { "hip.flex": 18, "hip.abd": 8, "knee.flex": 16, "ankle.dorsi": 6 };
const REAR_UP = { "hip.flex": 16, "hip.abd": 8, "knee.flex": 18, "ankle.dorsi": -6 };
const FRONT_DOWN = { "hip.flex": 84, "hip.abd": 12, "knee.flex": 94, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 18, "hip.abd": 8, "knee.flex": 70, "ankle.dorsi": -4 };

export const spec = buildExerciseSpec({
  id: "bodyweight-reverse-lunge",
  catalogId: "1a25c6f170d880f3a690d8bbd6bf4708",
  name: "Bodyweight Reverse Lunge",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.16,
    trackKnees: 10,
    split: { frontSide: "L", frontZ: 0.22, rearZ: -0.34, rearMode: "toe", rearY: 0.05 },
  },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, { ...TRUNK, "root.y": 0.72, "root.z": 0.02, "root.pitch": 8 }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack("Keep your torso in an upright position and the top of your hip bones level with each other."),
    checkFeetPlanted(
      "Continue keeping the entirety of your front foot in contact with the ground.",
      ["L"],
    ),
    checkJointRange(
      "front-knee",
      "Front thigh nears parallel",
      "At the end of the lowering phase, your front leg’s thigh should be close to parallel to the ground.",
      "knee_L.flex",
      45,
    ),
    checkJointRange(
      "rear-knee",
      "Rear knee descends to a tap",
      "Lower your body until you are able to tap the ground gently with the kneecap of your rear leg.",
      "knee_R.flex",
      28,
    ),
    checkJointWithinAt(
      "arms-down",
      "Arms stay by the sides",
      "You can position your hands wherever you prefer, such as resting by your sides.",
      "elbow_L.flex",
      "bottom",
      0,
      28,
    ),
    checkAnchorTravel(
      "depth",
      "Reverse lunge lowers",
      "After contacting the ground with your rear foot, allow your knees to bend as you lower your body in a controlled manner.",
      "pelvisBottom",
      "y",
      0.14,
    ),
  ],
});
