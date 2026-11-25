import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { keepAbove, pin } from "../solver";
import { Vector3 } from "three";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "clavicle.elev": 8,
  "shoulder.elev": 70,
  "shoulder.plane": 62,
  "shoulder.twist": -10,
  "elbow.flex": 28,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const STANCE = { "hip.flex": 8, "hip.abd": 4, "knee.flex": 8, "ankle.dorsi": 4 };
const FREE_UP = { "hip.flex": 88, "hip.abd": 2, "hip.rot": 4, "knee.flex": 18, "ankle.dorsi": 8 };
const STANCE_DOWN = { "hip.flex": 105, "hip.abd": 8, "hip.rot": 4, "knee.flex": 120, "ankle.dorsi": 24 };
const FREE_DOWN = { "hip.flex": 100, "hip.abd": 8, "hip.rot": 4, "knee.flex": 36, "ankle.dorsi": 10 };

export const spec = buildExerciseSpec({
  id: "assisted-pistol-squat",
  catalogId: "1a25c6f170d8800c8241f74bc4bc2ab2",
  name: "Assisted Pistol Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", singleFoot: "L", stanceX: 0.02, heelZ: -0.02, trackKnees: 12, balanceZ: 0.06 },
  apparatus: {
    kind: "rings",
    anchorY: 2.2,
    spacing: 0.42,
    bodyweightShare: 0.02,
  },
  hints: {
    start: sidedHints("L", STANCE, FREE_UP, {
      ...POSTURE_HINTS.standing,
      "root.z": -0.02,
      "root.pitch": 6,
      "lumbar.flex": 2,
      "thoracic.flex": 2,
      "neck.flex": 4,
      ...ARMS,
    }),
    end: sidedHints("L", STANCE_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      "root.y": 0.52,
      "root.z": 0.02,
      "root.pitch": 28,
      "lumbar.flex": 10,
      "thoracic.flex": 8,
      "neck.flex": 10,
      ...ARMS,
      "elbow.flex": 40,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(0.04, 0, 0), 50, "x"),
    keepAbove(body, "heel_R", 0.08, 70),
    keepAbove(body, "toe_R", 0.06, 50),
  ],
  checks: () => [
    checkFlatBack(
      "Strive to keep your back near a neutral position as you avoid excessively rounding your lower back.",
      22,
    ),
    checkFeetPlanted(
      "Keep the entirety of your foot firmly in contact with the ground throughout your set.",
      ["L"],
    ),
    checkJointWithinAt(
      "free-leg",
      "Free thigh stays near parallel",
      "Lift that thigh up until it is parallel to the ground with your knee as straight as your hamstring flexibility permits.",
      "hip_R.flex",
      "bottom",
      55,
      120,
    ),
    checkJointWithinAt(
      "free-knee",
      "Free knee stays mostly straight",
      "Keep this leg close to parallel to the ground without letting its foot touch the ground.",
      "knee_R.flex",
      "bottom",
      0,
      40,
    ),
    checkJointRange(
      "working-knee",
      "Working knee squats deep",
      "Continue to squat down through the full range of motion that your mobility comfortably enables.",
      "knee_L.flex",
      70,
    ),
    checkAnchorTravel(
      "depth",
      "Assisted pistol lowers",
      "Bend at your hip and knee to squat down in a controlled manner while assisting with your arms as needed.",
      "pelvisBottom",
      "y",
      0.22,
    ),
  ],
});
