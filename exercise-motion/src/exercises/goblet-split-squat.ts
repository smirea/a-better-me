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
  "root.pitch": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
  ...GOBLET,
};

const FRONT_UP = { "hip.flex": 26, "hip.abd": 8, "knee.flex": 26, "ankle.dorsi": 8 };
const REAR_UP = { "hip.flex": 22, "hip.abd": 8, "knee.flex": 28, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 84, "hip.abd": 12, "knee.flex": 94, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 34, "hip.abd": 8, "knee.flex": 98, "ankle.dorsi": -6 };

export const spec = buildExerciseSpec({
  id: "goblet-split-squat",
  catalogId: "1fd5c6f170d8809f8bf4cbb9d8e6dbf1",
  name: "Goblet Split Squat",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.14,
    trackKnees: 10,
    split: { frontSide: "L", frontZ: 0.22, rearZ: -0.3, rearMode: "toe", rearY: 0.06 },
  },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  hints: {
    start: sidedHints("L", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("L", FRONT_DOWN, REAR_DOWN, { ...TRUNK, "root.y": 0.72, "root.z": 0.02, "root.pitch": 10 }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack("Keep your torso in an upright position and the top of your hip bones level with each other."),
    checkFeetPlanted("Continue keeping the entirety of your front foot in contact with the ground.", ["L"]),
    checkJointWithinAt(
      "goblet",
      "Goblet stays at the chest",
      "Hold it right next to your chest with bent elbows, as your upper arms are slightly in front of your sides.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkJointWithinAt(
      "soft-knee",
      "Front knee stays slightly bent at the top",
      "You can finish the ascent with a slight bend in your front knee rather than fully locking it out.",
      "knee_L.flex",
      "top",
      8,
      35,
    ),
    checkJointRange(
      "front-knee",
      "Front thigh nears parallel",
      "At the end of the lowering phase, your front leg’s thigh should be close to parallel to the ground.",
      "knee_L.flex",
      55,
    ),
    checkAnchorTravel(
      "depth",
      "Split squat lowers",
      "From your split stance position, allow your knees to bend as you lower your body in a controlled manner.",
      "pelvisBottom",
      "y",
      0.16,
    ),
  ],
});
