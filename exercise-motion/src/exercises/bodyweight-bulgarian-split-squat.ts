import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";
import { Vector3 } from "three";

const ARMS = {
  "shoulder.elev": 8,
  "shoulder.plane": 12,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.02,
  "root.pitch": 16,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 6,
  ...ARMS,
};

const FRONT_UP = { "hip.flex": 28, "hip.abd": 8, "hip.rot": 6, "knee.flex": 26, "ankle.dorsi": 10 };
const REAR_UP = { "hip.flex": 16, "hip.abd": 2, "hip.rot": 4, "knee.flex": 72, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 88, "hip.abd": 10, "hip.rot": 4, "knee.flex": 98, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 22, "hip.abd": 2, "hip.rot": 4, "knee.flex": 100, "ankle.dorsi": -6 };

export const spec = buildExerciseSpec({
  id: "bodyweight-bulgarian-split-squat",
  catalogId: "1a25c6f170d880878b1ec1de56994a35",
  name: "Bodyweight Bulgarian Split Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0.16,
    trackKnees: 8,
    balanceZ: 0.02,
    split: { frontSide: "R", frontZ: -0.02, rearZ: -0.55, rearMode: "elevated-stand" },
  },
  apparatus: { kind: "none" },
  hints: {
    start: sidedHints("R", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("R", FRONT_DOWN, REAR_DOWN, {
      ...TRUNK,
      "root.y": 0.74,
      "root.z": 0.02,
      "root.pitch": 12,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [pin(body, "pelvisBottom", () => new Vector3(-0.16, 0, 0), 80, "x")],
  checks: () => [
    checkFlatBack(
      "Return to keeping your torso in a fairly upright position, which should involve you maintaining the natural curvature of your lower back.",
    ),
    checkFeetPlanted("Keep the entire sole of your front foot firmly planted on the ground.", ["R"]),
    checkJointRange(
      "front-knee",
      "Front knee bends toward parallel",
      "At the end of the lowering phase, your front leg’s thigh should be close to parallel to the ground.",
      "knee_R.flex",
      40,
    ),
    checkJointRange(
      "rear-knee",
      "Rear knee descends toward the floor",
      "Lower your body in a controlled manner until you are able to tap the ground gently with the kneecap of your rear leg.",
      "knee_L.flex",
      16,
    ),
    checkJointWithinAt(
      "front-thigh",
      "Front thigh near parallel at the bottom",
      "At the end of the lowering phase, your front leg’s thigh should be close to parallel to the ground.",
      "knee_R.flex",
      "bottom",
      55,
      125,
    ),
    checkAnchorTravel(
      "depth",
      "Body lowers in the split stance",
      "From your split stance position, allow your knees to bend as you lower your body in a controlled manner.",
      "pelvisBottom",
      "y",
      0.1,
    ),
  ],
});
