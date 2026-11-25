import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { balance } from "../solver";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const GOBLET = {
  "shoulder.elev": 50,
  "shoulder.plane": 74,
  "shoulder.twist": 16,
  "elbow.flex": 108,
  "forearm.pron": -46,
  "wrist.flex": 6,
  "clavicle.elev": 6,
};

const STANCE = { "hip.flex": 14, "hip.abd": 8, "knee.flex": 16, "ankle.dorsi": 6 };
const FREE_UP = { "hip.flex": 55, "hip.abd": -8, "hip.rot": 4, "knee.flex": 100, "ankle.dorsi": 4 };
const STANCE_DOWN = { "hip.flex": 80, "hip.abd": 12, "hip.rot": 6, "knee.flex": 92, "ankle.dorsi": 16 };
const FREE_DOWN = { "hip.flex": 40, "hip.abd": -6, "hip.rot": 4, "knee.flex": 115, "ankle.dorsi": 6 };

export const spec = buildExerciseSpec({
  id: "goblet-skater-squat",
  catalogId: "2035c6f170d880918334c79fd5fe63ca",
  name: "Goblet Skater Squat",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", singleFoot: "L", stanceX: -0.04, heelZ: 0, trackKnees: 10, balanceZ: 0.12 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.x": 0.08,
      "root.z": 0.08,
      "root.pitch": 18,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "neck.flex": 4,
      ...GOBLET,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.7,
      "root.x": 0.1,
      "root.z": 0.06,
      "root.pitch": 24,
      "lumbar.flex": 8,
      "thoracic.flex": 6,
      "neck.flex": 10,
      ...GOBLET,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [balance(body, [{ anchor: "grip_L", kg: 4 }, { anchor: "grip_R", kg: 4 }], 0.14, 90)],
  checks: () => [
    checkFlatBack(
      "Keep your back near a neutral position as you avoid excessively rounding your lower back or letting your upper back cave.",
      16,
    ),
    checkFeetPlanted(
      "Keep the entirety of your working leg’s foot firmly in contact with the ground throughout your set.",
      ["L"],
    ),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays bent past 90 degrees",
      "Pick the other foot up off the ground by bending that side’s knee by greater than 90 degrees.",
      "knee_R.flex",
      "top",
      90,
      145,
    ),
    checkJointRange(
      "working-knee",
      "Working knee squats down",
      "Progressively bend at your knee and hip to squat down until you can gently tap the ground with your free leg’s knee.",
      "knee_L.flex",
      55,
    ),
    checkJointWithinAt(
      "hip-hinge",
      "Working hip hinges as the torso inclines",
      "It can be helpful to initiate the descent by mildly sitting your buttocks back through a hip hinge motion that mildly inclines your torso.",
      "hip_L.flex",
      "bottom",
      60,
      110,
    ),
    checkAnchorTravel(
      "depth",
      "Skater squat lowers",
      "Squat down in a controlled manner until you can gently tap the ground with your free leg’s knee.",
      "pelvisBottom",
      "y",
      0.14,
    ),
  ],
});
