import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const HANG = {
  "shoulder.elev": 8,
  "shoulder.plane": 0,
  "elbow.flex": 5,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 5,
  "lumbar.flex": 1,
  "thoracic.flex": 0,
  "neck.flex": 4,
  ...HANG,
};

const FRONT_UP = { "hip.flex": 24, "hip.abd": 8, "knee.flex": 22, "ankle.dorsi": 8 };
const REAR_UP = { "hip.flex": 22, "hip.abd": 8, "knee.flex": 26, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 86, "hip.abd": 12, "knee.flex": 96, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 18, "hip.abd": 8, "knee.flex": 62, "ankle.dorsi": -4 };

export const spec = buildExerciseSpec({
  id: "kettlebell-walking-lunge",
  catalogId: "1a25c6f170d880298b20cb659f512be0",
  name: "Kettlebell Walking Lunge",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.2,
    trackKnees: 10,
    split: { frontSide: "L", frontZ: 0.24, rearZ: -0.28, rearMode: "toe", rearY: 0.06 },
  },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: true },
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, { ...TRUNK, "root.y": 0.7, "root.z": 0.04, "root.pitch": 10 }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack("Keep your torso in an upright position and the top of your hip bones level with each other."),
    checkFeetPlanted(
      "Keep the entirety of your front foot’s sole in contact with the ground.",
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
      "Rear knee reaches toward the floor",
      "Lower your body until you are able to tap the ground gently with the kneecap of your rear leg.",
      "knee_R.flex",
      28,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms stay directed down",
      "Continue keeping your elbows straight and arms directed straight down by your sides.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkAnchorTravel(
      "depth",
      "Walking lunge lowers",
      "Allow your knees to bend as you lower your body in a controlled manner.",
      "pelvisBottom",
      "y",
      0.14,
    ),
  ],
});
