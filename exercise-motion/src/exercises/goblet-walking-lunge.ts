import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const GOBLET = {
  "shoulder.elev": 48,
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "elbow.flex": 112,
  "forearm.pron": -50,
  "wrist.flex": 8,
  "clavicle.elev": 6,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 5,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  ...GOBLET,
};

const FRONT_UP = { "hip.flex": 24, "hip.abd": 8, "knee.flex": 22, "ankle.dorsi": 8 };
const REAR_UP = { "hip.flex": 22, "hip.abd": 8, "knee.flex": 26, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 86, "hip.abd": 12, "knee.flex": 96, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 36, "hip.abd": 8, "knee.flex": 100, "ankle.dorsi": -6 };

export const spec = buildExerciseSpec({
  id: "goblet-walking-lunge",
  catalogId: "1fd5c6f170d880efa105de08ecd6de91",
  name: "Goblet Walking Lunge",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.14,
    trackKnees: 10,
    split: { frontSide: "L", frontZ: 0.24, rearZ: -0.28, rearMode: "toe", rearY: 0.06 },
  },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, { ...TRUNK, "root.y": 0.7, "root.z": 0.04, "root.pitch": 10 }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack("Keep your torso in an upright position and the top of your hip bones level with each other."),
    checkFeetPlanted("Keep the entirety of your front foot’s sole in contact with the ground.", ["L"]),
    checkJointWithinAt(
      "goblet",
      "Goblet stays at the chest",
      "Hold it right next to your chest with bent elbows, as your upper arms are slightly in front of your sides.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkJointRange(
      "front-knee",
      "Front thigh nears parallel",
      "At the end of the lowering phase, your front leg’s thigh should be close to parallel to the ground.",
      "knee_L.flex",
      55,
    ),
    checkJointRange(
      "rear-knee",
      "Rear knee descends to a tap",
      "Lower your body until you are able to tap the ground gently with the kneecap of your rear leg.",
      "knee_R.flex",
      55,
    ),
    checkAnchorTravel(
      "depth",
      "Walking lunge lowers",
      "Allow your knees to bend as you lower your body in a controlled manner.",
      "pelvisBottom",
      "y",
      0.18,
    ),
  ],
});
