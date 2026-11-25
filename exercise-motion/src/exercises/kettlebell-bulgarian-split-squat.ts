import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { Vector3 } from "three";
import { balance, pin } from "../solver";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const HANG = {
  "shoulder.elev": 8,
  "shoulder.plane": 15,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.z": 0.04,
  "root.pitch": 18,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 8,
  ...HANG,
};

const FRONT_UP = { "hip.flex": 28, "hip.abd": 8, "hip.rot": 6, "knee.flex": 28, "ankle.dorsi": 10 };
const REAR_UP = { "hip.flex": 18, "hip.abd": 2, "hip.rot": 4, "knee.flex": 70, "ankle.dorsi": -8 };
const FRONT_DOWN = { "hip.flex": 88, "hip.abd": 10, "hip.rot": 4, "knee.flex": 96, "ankle.dorsi": 16 };
const REAR_DOWN = { "hip.flex": 24, "hip.abd": 2, "hip.rot": 4, "knee.flex": 96, "ankle.dorsi": -6 };

export const spec = buildExerciseSpec({
  id: "kettlebell-bulgarian-split-squat",
  catalogId: "1a25c6f170d8805c8b30c1b4200ca82d",
  name: "Kettlebell Bulgarian Split Squat",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Drive", "Stand"],
  station: {
    kind: "standing",
    stanceX: 0,
    trackKnees: 10,
    balanceZ: 0.3,
    split: { frontSide: "R", frontZ: 0.08, rearZ: -0.36, rearMode: "elevated-stand" },
  },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: true },
  hints: {
    start: sidedHints("R", FRONT_UP, REAR_UP, TRUNK),
    end: sidedHints("R", FRONT_DOWN, REAR_DOWN, {
      ...TRUNK,
      "root.y": 0.74,
      "root.z": 0.02,
      "root.pitch": 16,
    }),
  },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  extraGoals: (body) => [
    balance(body, [{ anchor: "grip_L", kg: 4 }, { anchor: "grip_R", kg: 4 }], 0.14, 30),
    pin(body, "pelvisBottom", () => new Vector3(0, 0, 0), 36, "x"),
  ],
  checks: () => [
    checkFlatBack(
      "Return to keeping your torso in a fairly upright position, which should involve you maintaining the natural curvature of your lower back like when you are normally standing upright.",
    ),
    checkFeetPlanted(
      "Keep the entire sole of your front foot firmly planted on the ground.",
      ["R"],
    ),
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
      18,
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
