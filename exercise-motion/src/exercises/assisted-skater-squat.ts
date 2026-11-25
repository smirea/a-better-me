import { platformBox } from "../equipment-library";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "clavicle.elev": 6,
  "shoulder.elev": 58,
  "shoulder.plane": 55,
  "shoulder.twist": -8,
  "elbow.flex": 32,
  "forearm.pron": 12,
  "wrist.flex": 0,
};

const STANCE = { "hip.flex": 12, "hip.abd": 6, "knee.flex": 12, "ankle.dorsi": 6 };
const FREE_UP = { "hip.flex": 36, "hip.abd": -4, "hip.rot": 4, "knee.flex": 108, "ankle.dorsi": 4 };
const STANCE_DOWN = { "hip.flex": 74, "hip.abd": 10, "hip.rot": 4, "knee.flex": 92, "ankle.dorsi": 16 };
const FREE_DOWN = { "hip.flex": 26, "hip.abd": -4, "hip.rot": 4, "knee.flex": 118, "ankle.dorsi": 6 };

export const spec = buildExerciseSpec({
  id: "assisted-skater-squat",
  catalogId: "2025c6f170d8802087dbe1cd4f961919",
  name: "Assisted Skater Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", singleFoot: "L", stanceX: 0.0, heelZ: 0.0, trackKnees: 10, balanceZ: 0.06 },
  apparatus: { kind: "rings", anchorY: 1.7, spacing: 0.5, bodyweightShare: 0.02 },
  extraEquipment: platformBox("skater.pad", [0.04, 0, -0.36], 0.26, 0.06, 0.22, "pad"),
  extraContacts: { "skater.pad": { shank_R: 0.05, foot_R: 0.04 } },
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.z": -0.02,
      "root.pitch": 12,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "neck.flex": 4,
      ...ARMS,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.68,
      "root.x": 0.04,
      "root.z": 0.0,
      "root.pitch": 20,
      "lumbar.flex": 6,
      "thoracic.flex": 4,
      "neck.flex": 8,
      ...ARMS,
      "elbow.flex": 42,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0.04, 0, 0), 55, "x")],
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
      "Working knee squats to a knee tap",
      "Squat down in a controlled manner until you can gently tap the ground with your free leg’s knee.",
      "knee_L.flex",
      50,
    ),
    checkAnchorTravel(
      "depth",
      "Assisted skater squat lowers",
      "Progressively bend at your hip and knee to squat down until you can gently tap the ground with your free leg’s knee.",
      "pelvisBottom",
      "y",
      0.14,
    ),
  ],
});
