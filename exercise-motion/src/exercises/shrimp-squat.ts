import { exerciseMat } from "../equipment-library";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const REACH = {
  "shoulder_L.elev": 82,
  "shoulder_L.plane": 74,
  "shoulder_L.twist": -18,
  "elbow_L.flex": 8,
  "forearm_L.pron": 20,
  "wrist_L.flex": 0,
  "clavicle_L.elev": 8,
};

const HOLD = {
  "shoulder_R.elev": 8,
  "shoulder_R.plane": 20,
  "shoulder_R.twist": 30,
  "elbow_R.flex": 118,
  "forearm_R.pron": 40,
  "wrist_R.flex": 8,
  "clavicle_R.elev": 2,
};

const STANCE = { "hip.flex": 12, "hip.abd": 6, "knee.flex": 10, "ankle.dorsi": 6 };
const FREE_UP = { "hip.flex": 16, "hip.abd": 10, "hip.rot": 0, "knee.flex": 118, "ankle.dorsi": 4 };
const STANCE_DOWN = { "hip.flex": 78, "hip.abd": 10, "hip.rot": 2, "knee.flex": 98, "ankle.dorsi": 16 };
const FREE_DOWN = { "hip.flex": 22, "hip.abd": 12, "hip.rot": 0, "knee.flex": 122, "ankle.dorsi": 4 };

export const spec = buildExerciseSpec({
  id: "shrimp-squat",
  catalogId: "2035c6f170d88080a706f7f7b7d76b18",
  name: "Shrimp Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", singleFoot: "L", stanceX: 0.02, heelZ: 0.02, trackKnees: 10, balanceZ: 0.08 },
  apparatus: { kind: "none" },
  extraEquipment: exerciseMat(0.8, 1.6, -0.1),
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.x": 0.04,
      "root.pitch": 8,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "neck.flex": 4,
      ...REACH,
      ...HOLD,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.64,
      "root.x": 0.05,
      "root.z": 0.02,
      "root.pitch": 22,
      "lumbar.flex": 6,
      "thoracic.flex": 4,
      "neck.flex": 8,
      ...REACH,
      ...HOLD,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0.05, 0, 0), 40, "x")],
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
      "held-knee",
      "Free knee stays fully bent",
      "Use your hand to fully bend the knee of your free leg as you hold its foot close to your buttock.",
      "knee_R.flex",
      "bottom",
      100,
      145,
    ),
    checkJointWithinAt(
      "reach-arm",
      "Working-side arm stays out in front",
      "On the side of your body where your foot is on the ground, raise your arm until it is approximately parallel with the ground.",
      "shoulder_L.elev",
      "top",
      60,
      110,
    ),
    checkJointRange(
      "working-knee",
      "Working knee squats down",
      "Progressively bend at your hip and knee to squat down until you can gently tap the ground with your free leg’s knee.",
      "knee_L.flex",
      55,
    ),
    checkAnchorTravel(
      "depth",
      "Shrimp squat lowers",
      "Squat down in a controlled manner until you can gently tap the ground with your free leg’s knee.",
      "pelvisBottom",
      "y",
      0.16,
    ),
  ],
});
