import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { keepAbove, pin } from "../solver";

/** Prone on the mat. Left arm rows a low D-handle. Left knee is bent out. Right forearm braces. */
const PRONE = {
  "root.y": 0.22,
  "root.z": 0.02,
  "root.pitch": 90,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -6,
  "hip_L.flex": 8,
  "hip_L.abd": 22,
  "hip_L.rot": 6,
  "knee_L.flex": 55,
  "ankle_L.dorsi": 4,
  "hip_R.flex": 2,
  "hip_R.abd": 4,
  "knee_R.flex": 4,
  "ankle_R.dorsi": 12,
};

const ACTIVE_REACH = {
  "shoulder.elev": 165,
  "shoulder.plane": 75,
  "shoulder.twist": 6,
  "elbow.flex": 14,
  "forearm.pron": 35,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": 6,
};

const ACTIVE_ROW = {
  "shoulder.elev": 140,
  "shoulder.plane": 48,
  "shoulder.twist": 4,
  "elbow.flex": 108,
  "forearm.pron": 28,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -12,
};

const BRACE = {
  "shoulder.elev": 150,
  "shoulder.plane": 35,
  "elbow.flex": 55,
  "forearm.pron": 65,
  "wrist.flex": 10,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "moto-cable-row",
  catalogId: "2ab5c6f170d88040b3b2f304bf353024",
  name: "Moto Cable Row",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Side", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "down",
    feetOnFloor: false,
    pinSacrum: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.22, 0.32, 1.15],
    columnPos: [0.28, 1.55],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", ACTIVE_REACH, BRACE, PRONE),
    end: sidedHints("L", ACTIVE_ROW, BRACE, PRONE),
  },
  extraGoals: (body) => [
    pin(body, "pelvisFront", () => new Vector3(0, 0.18, -0.02), 90, "y"),
    pin(body, "chestFront", () => new Vector3(0, 0.16, 0.32), 70, "y"),
    keepAbove(body, "grip_R", 0.08, 46),
    keepAbove(body, "toe_R", 0.05, 36),
    keepAbove(body, "ballIn_R", 0.05, 36),
    keepAbove(body, "ballOut_R", 0.05, 36),
    keepAbove(body, "grip_L", 0.06, 24),
  ],
  checks: () => [
    checkJointRange(
      "elbow-row",
      "Working elbow bends as the handle comes in",
      "Drive your elbow back toward your side while progressively bending it to pull the handle toward you.",
      "elbow_L.flex",
      40,
    ),
    checkJointWithinAt(
      "arm-long",
      "Working arm starts straight toward the pulley",
      "Reach forward toward the low pulley and grasp the handle with your elbow straight.",
      "elbow_L.flex",
      "top",
      0,
      75,
    ),
    checkJointWithinAt(
      "elbow-by-side",
      "Upper arm finishes by the side",
      "Pull through a full range so the upper arm ends by your side, with the forearm aligned with the cable.",
      "elbow_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointWithinAt(
      "knee-out",
      "Working-side knee stays bent out",
      "On the side you train, keep the knee bent and out to the side with the inner thigh toward the ground.",
      "knee_L.flex",
      "bottom",
      35,
      100,
    ),
    checkJointWithinAt(
      "brace-arm",
      "Free forearm stays braced",
      "Prop the forearm on the side you are not training onto the ground and keep bracing with it.",
      "elbow_R.flex",
      "bottom",
      30,
      90,
    ),
    checkJointWithinAt(
      "chest-down",
      "Torso stays down",
      "The rest of your body stays stationary on the ground while the working shoulder and elbow move.",
      "hip_R.flex",
      "bottom",
      -10,
      25,
    ),
  ],
});
