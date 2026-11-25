import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * One low cable beside the working shoulder. The line of pull is down and out;
 * the shrug travels up and in, along the upper-trap fibers, with the elbow straight.
 */
const DOWN_OUT = {
  "shoulder.elev": 32,
  "shoulder.plane": 8,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 4,
  "wrist.flex": 0,
  "clavicle.elev": -8,
  "clavicle.prot": 14,
};

const UP_IN = {
  ...DOWN_OUT,
  "shoulder.elev": 22,
  "shoulder.plane": 4,
  "clavicle.elev": 26,
  "clavicle.prot": -14,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 10,
  "forearm.pron": 8,
  "clavicle.elev": 0,
  "clavicle.prot": 0,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 12,
  "hip.flex": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "cable-shrug-in",
  catalogId: "1a15c6f170d88085ac39d58628c8de89",
  name: "Cable Shrug-In",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Shrug in", "Up and in", "Lower", "Down and out"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.3, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    toeOutDeg: 6,
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.78, 0.2, 0.08],
    columnPos: [0.95, 0.05],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 6, lumbar: 8, thoracic: 6, clavicle: 1.05 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: sidedHints("L", DOWN_OUT, REST, STANCE),
    end: sidedHints("L", UP_IN, REST, STANCE),
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso upright. Do not let the cable bend the trunk toward the pulley.",
    ),
    checkNeutralNeck("Keep the neck neutral, as when you are standing upright and looking straight ahead."),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Shrug the shoulder and shoulder blade up and in while the elbow stays straight.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointRange(
      "elevation",
      "Shoulder girdle elevates",
      "Move the shoulder diagonally opposite the cable, up toward the ear.",
      "clavicle_L.elev",
      18,
    ),
    checkJointRange(
      "retraction",
      "Shoulder blade pulls inward",
      "Pull the shoulder blade in toward the midline as it rises, along the upper-trap fibers.",
      "clavicle_L.prot",
      12,
    ),
  ],
});
