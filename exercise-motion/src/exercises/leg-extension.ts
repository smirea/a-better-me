import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const SEAT_Y = 0.6;
const HANDLE_L = new Vector3(0.27, SEAT_Y - 0.02, 0.08);
const PULLEY: [number, number, number] = [0, 0.16, -0.35];

const SEATED = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.y": 0.67,
  "root.z": -0.04,
  "root.pitch": -20,
  "hip.flex": 63,
  "hip.abd": 8,
  "hip.rot": 2,
  "ankle.dorsi": -8,
  "lumbar.flex": 6,
  "thoracic.flex": -2,
  "neck.flex": -4,
  "clavicle.elev": 2,
  "shoulder.elev": 14,
  "shoulder.plane": 18,
  "shoulder.twist": 6,
  "elbow.flex": 28,
  "forearm.pron": 20,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "leg-extension",
  catalogId: "1a25c6f170d880c59f17ce7802758fc3",
  name: "Leg Extension",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Extend", "Straight", "Lower", "Bend"],
  tempo: { lower: 1.5, bottom: 0.35, raise: 1.8, top: 0.35 },
  station: {
    kind: "seated",
    seatY: SEAT_Y,
    seatZ: -0.05,
    leanDeg: -18,
    feetMode: "hanging",
    lockHipFlexDeg: 63,
    frame: { type: "leg-extension", backAngleDeg: 70, thighRollerY: 0.78 },
  },
  apparatus: {
    kind: "roller-pad",
    width: 0.46,
    radius: 0.055,
    trackAnchors: ["shinFront_L", "shinFront_R"],
    localOffset: [0, 0, 0.055],
    pulley: PULLEY,
  },
  hints: {
    start: { ...SEATED, "knee.flex": 108 },
    end: { ...SEATED, "knee.flex": 6 },
  },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.abd", 8, 14),
    lockAngle(body, "hip_R.abd", 8, 14),
    lockAngle(body, "ankle_L.dorsi", -8, 8),
    lockAngle(body, "ankle_R.dorsi", -8, 8),
  ],
  extraRequired: [
    { label: "Left hand on the handle", anchor: "grip_L", part: "legext.handleL" },
    { label: "Right hand on the handle", anchor: "grip_R", part: "legext.handleR" },
  ],
  checks: (body) => [
    checkJointWithinAt(
      "knees-bent",
      "Rep starts with the knees bent",
      "Begin each rep with the greatest knee bend you can achieve, with your lower shins behind the shin pad.",
      "knee_L.flex",
      "start",
      90,
      130,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees fully straighten",
      "Extend your knees to lift up the shin pad until you have fully straightened your knees.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointRange(
      "knee-rom",
      "Knee extension through the machine's range",
      "Through a controlled kicking motion, progressively extend your knees, then bend them back to the start.",
      "knee_L.flex",
      85,
    ),
    {
      id: "thighs-still",
      label: "Thighs stay on the seat",
      cue: "Keep the rest of your body stationary throughout your set as your thighs remain in contact with the seat.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["hip_L.flex"] - context.angles[context.top]["hip_L.flex"])),
          8,
          "° of hip movement",
        ),
    },
    {
      id: "hands-on-handles",
      label: "Hands stay on the handles",
      cue: "Firmly grasp the handles and continue holding them throughout your set.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => anchorPoint(body, frame, "grip_L").distanceTo(HANDLE_L) * 100,
          2.5,
          " cm off the handle",
        ),
    },
    {
      id: "back-on-pad",
      label: "Back stays against the pad",
      cue: "Sit with your back resting against the back pad and keep the rest of your body stationary.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => Math.abs(deg(angles["lumbar.flex"] - context.angles[context.top]["lumbar.flex"])),
          6,
          "° of torso shift",
        ),
    },
  ],
});
