import { platformBox } from "../equipment-library";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "clavicle.elev": 8,
  "shoulder.elev": 68,
  "shoulder.plane": 58,
  "shoulder.twist": -20,
  "elbow.flex": 22,
  "forearm.pron": 24,
  "wrist.flex": 0,
};

const STANCE = { "hip.flex": 10, "hip.abd": 6, "knee.flex": 10, "ankle.dorsi": 4 };
const FREE_UP = { "hip.flex": 40, "hip.abd": -4, "hip.rot": 4, "knee.flex": 108, "ankle.dorsi": 4 };
const STANCE_DOWN = { "hip.flex": 52, "hip.abd": 8, "hip.rot": 4, "knee.flex": 62, "ankle.dorsi": 12 };
const FREE_DOWN = { "hip.flex": 24, "hip.abd": -2, "hip.rot": 4, "knee.flex": 112, "ankle.dorsi": 4 };

export const spec = buildExerciseSpec({
  id: "partial-range-of-motion-skater-squat",
  catalogId: "2025c6f170d8807fa81af9920531b960",
  name: "Partial Range Of Motion Skater Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", singleFoot: "L", stanceX: 0.06, heelZ: 0.04, trackKnees: 10, balanceZ: 0.12 },
  apparatus: { kind: "none" },
  extraEquipment: platformBox("skater.pad", [-0.08, 0, -0.34], 0.28, 0.16, 0.24, "pad"),
  extraContacts: { "skater.pad": { shank_R: 0.05, foot_R: 0.04 } },
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.x": 0.04,
      "root.z": 0.02,
      "root.pitch": 8,
      "lumbar.flex": 2,
      "thoracic.flex": 0,
      "neck.flex": 4,
      ...ARMS,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.78,
      "root.x": 0.04,
      "root.z": 0.0,
      "root.pitch": 16,
      "lumbar.flex": 4,
      "thoracic.flex": 2,
      "neck.flex": 6,
      ...ARMS,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0.06, 0, 0), 60, "x")],
  checks: () => [
    checkFlatBack(
      "Strive to keep your back near a neutral position as you avoid excessively rounding your lower back.",
      14,
    ),
    checkFeetPlanted(
      "Keep the entirety of your working leg’s foot firmly in contact with the ground throughout your set.",
      ["L"],
    ),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays bent past 90 degrees",
      "Bend that side’s knee greater than 90 degrees while keeping its thigh directed down toward the ground.",
      "knee_R.flex",
      "bottom",
      90,
      145,
    ),
    checkJointRange(
      "working-knee",
      "Working knee descends to the pad",
      "Squat down in a controlled manner until you can gently tap the elevated object with your free leg’s knee.",
      "knee_L.flex",
      30,
    ),
    checkJointWithinAt(
      "partial-depth",
      "Depth stops above a full skater squat",
      "The difficulty of the exercise will directly increase as you decrease the height of your object.",
      "knee_L.flex",
      "bottom",
      40,
      85,
    ),
    checkAnchorTravel(
      "depth",
      "Partial skater squat lowers",
      "Progressively bend at your knee and hip to squat down until you can gently tap the elevated object.",
      "pelvisBottom",
      "y",
      0.08,
    ),
  ],
});
