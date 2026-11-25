import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

const ARMS = {
  "shoulder.elev": 10,
  "shoulder.plane": 12,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.98,
  "root.pitch": 12,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 6,
  ...ARMS,
};

const LEAD_UP = { "hip.flex": 16, "hip.abd": 4, "knee.flex": 16, "ankle.dorsi": 6 };
const REAR_UP = { "hip.flex": 8, "hip.abd": 4, "knee.flex": 8, "ankle.dorsi": -6 };
const LEAD_DOWN = { "hip.flex": 88, "hip.abd": 8, "knee.flex": 104, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 14, "hip.abd": 6, "knee.flex": 36, "ankle.dorsi": -4 };

export const spec = buildExerciseSpec({
  id: "bodyweight-step-up",
  catalogId: "1a25c6f170d8805fb925ea7f1d8c9917",
  name: "Bodyweight Step-Up",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.14,
    surfaceY: 0.12,
    trackKnees: 6,
    balanceZ: 0.08,
    box: { height: 0.12, width: 0.42, depth: 0.3, z: 0.32 },
    split: { frontSide: "L", frontZ: 0.28, rearZ: -0.08, rearMode: "flat", rearY: 0 },
  },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("L", LEAD_UP, REAR_UP, TRUNK),
    end: sidedHints("L", LEAD_DOWN, REAR_DOWN, {
      ...TRUNK,
      "root.y": 0.72,
      "root.z": 0.08,
      "root.pitch": 18,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(0.1, 0, 0), 70, "x")],
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "knee_L.flex", 18, 120)],
    end: [lockAngle(body, "knee_L.flex", 98, 90), lockAngle(body, "hip_L.flex", 90, 40)],
  }),
  checks: () => [
    checkFlatBack(
      "The forward torso should occur from you moving about your hip while you keep your back near a neutral position.",
      16,
    ),
    checkFeetPlanted("Keep the entire sole of your elevated foot firmly planted on the step.", ["L"], 0.12),
    checkJointWithinAt(
      "rear-knee",
      "Rear knee stays nearly straight",
      "In this starting position for the exercise, your rear leg’s knee should be straight.",
      "knee_R.flex",
      "top",
      0,
      22,
    ),
    checkJointRange(
      "lead-knee",
      "Lead knee drives the step",
      "Drive through your lead leg as you push down into the step by extending your knee and hip.",
      "knee_L.flex",
      25,
    ),
    checkAnchorTravel(
      "depth",
      "Step-up lowers onto the rear heel",
      "Bend your knee to lower yourself in a controlled manner until you can contact the ground with the heel of your other foot.",
      "pelvisBottom",
      "y",
      0.08,
    ),
  ],
});
