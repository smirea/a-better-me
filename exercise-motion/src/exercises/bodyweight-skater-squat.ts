import { exerciseMat } from "../equipment-library";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "clavicle.elev": 8,
  "shoulder.elev": 68,
  "shoulder.plane": 58,
  "elbow.flex": 22,
  "shoulder.twist": -20,

  "forearm.pron": 24,
  "wrist.flex": 0,
};

const STANCE = { "hip.flex": 12, "hip.abd": 6, "knee.flex": 12, "ankle.dorsi": 6 };
const FREE_UP = { "hip.flex": 42, "hip.abd": -4, "hip.rot": 4, "knee.flex": 112, "ankle.dorsi": 4 };
const STANCE_DOWN = { "hip.flex": 78, "hip.abd": 10, "hip.rot": 4, "knee.flex": 96, "ankle.dorsi": 18 };
const FREE_DOWN = { "hip.flex": 28, "hip.abd": -4, "hip.rot": 4, "knee.flex": 120, "ankle.dorsi": 6 };

export const spec = buildExerciseSpec({
  id: "bodyweight-skater-squat",
  catalogId: "1a25c6f170d880fc855cd36abbf96f85",
  name: "Bodyweight Skater Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", singleFoot: "L", stanceX: 0.06, heelZ: 0.02, trackKnees: 10, balanceZ: 0.1 },
  apparatus: { kind: "none" },
  extraEquipment: exerciseMat(0.8, 1.6, -0.15),
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.x": 0.06,
      "root.z": -0.02,
      "root.pitch": 18,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "neck.flex": 4,
      ...ARMS,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.66,
      "root.x": 0.05,
      "root.z": 0.02,
      "root.pitch": 22,
      "lumbar.flex": 6,
      "thoracic.flex": 4,
      "neck.flex": 8,
      ...ARMS,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0.06, 0, 0), 60, "x")],
  checks: () => [
    checkFlatBack(
      "Strive to keep your back near a neutral position as you avoid excessively rounding your lower back.",
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
      "Initiate the descent by mildly sitting your buttocks back through a hip hinge motion that somewhat inclines your torso.",
      "hip_L.flex",
      "bottom",
      55,
      115,
    ),
    checkAnchorTravel(
      "depth",
      "Skater squat lowers",
      "Squat down in a controlled manner until you can gently tap the ground with your free leg’s knee.",
      "pelvisBottom",
      "y",
      0.16,
    ),
  ],
});
