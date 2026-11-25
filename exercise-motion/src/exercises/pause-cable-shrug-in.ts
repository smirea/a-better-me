import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Same diagonal shrug-in as the continuous version, with a hold at the top. */
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
};

export const spec = buildExerciseSpec({
  id: "pause-cable-shrug-in",
  catalogId: "29d5c6f170d8802294c4cd80d0007a95",
  name: "Pause Cable Shrug-In",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Shrug in", "Pause", "Lower", "Down and out"],
  tempo: { lower: 1.5, bottom: 2, raise: 1.2, top: 0.25 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, balanceZ: false },
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
      "Keep the torso upright through the pause. Do not let the cable side-bend you toward the pulley.",
    ),
    checkNeutralNeck("Keep the neck neutral while you squeeze the shrugged-in position."),
    checkJointWithinAt(
      "paused-elevation",
      "Pause fully shrugged in",
      "Pause about two seconds with the shoulder and shoulder blade squeezed up and in.",
      "clavicle_L.elev",
      "peak",
      16,
      36,
    ),
    checkJointWithinAt(
      "paused-retraction",
      "Shoulder blade stays in at the pause",
      "At the pause the working shoulder is higher than the resting side and pulled toward the midline.",
      "clavicle_L.prot",
      "peak",
      -28,
      0,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Keep the elbow straight while the shoulder travels up and in, holds, then lowers.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointRange(
      "elevation",
      "Shoulder girdle elevates into the pause",
      "Shrug up and in, hold, then let the shoulder travel down and out toward the pulley.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
