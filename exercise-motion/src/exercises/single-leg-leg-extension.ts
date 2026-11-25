import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
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

const BENT = { "hip.flex": 63, "hip.abd": 8, "hip.rot": 2, "knee.flex": 108, "ankle.dorsi": -8 };
const STRAIGHT = { ...BENT, "knee.flex": 6 };

export const spec = buildExerciseSpec({
  id: "single-leg-leg-extension",
  catalogId: "1a25c6f170d880dcb28bc023b51f8285",
  name: "Single Leg Leg Extension",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Extend", "Straight", "Lower", "Bend"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.5, top: 0.3 },
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
    trackAnchors: ["shinFront_L"],
    localOffset: [0, 0, 0.055],
    pulley: PULLEY,
  },
  hints: {
    start: sidedHints("L", BENT, BENT, SEATED),
    end: sidedHints("L", STRAIGHT, BENT, SEATED),
  },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.abd", 8, 14),
    lockAngle(body, "hip_R.abd", 8, 14),
    lockAngle(body, "knee_R.flex", 108, 22),
    lockAngle(body, "ankle_L.dorsi", -8, 8),
    lockAngle(body, "ankle_R.dorsi", -8, 8),
  ],
  extraRequired: [
    { label: "Left hand on the handle", anchor: "grip_L", part: "legext.handleL" },
    { label: "Right hand on the handle", anchor: "grip_R", part: "legext.handleR" },
  ],
  checks: (body) => [
    checkJointWithinAt(
      "knee-bent",
      "Working knee starts bent",
      "Begin each rep with the greatest knee bend you can achieve, with your lower shin behind the shin pad.",
      "knee_L.flex",
      "start",
      90,
      130,
    ),
    checkJointWithinAt(
      "knee-straight",
      "Working knee fully straightens",
      "Extend one knee to lift the shin pad until that knee is fully straightened.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "resting-leg",
      "Resting knee stays bent",
      "Keep your other knee bent so that leg does not push the shin pad.",
      "knee_R.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "knee-rom",
      "Working knee extends through the machine's range",
      "Kick one knee straight, then bend it back to the start while the other knee stays bent.",
      "knee_L.flex",
      80,
    ),
    {
      id: "thighs-still",
      label: "Thighs stay on the seat",
      cue: "Keep the rest of your body stationary as your thighs remain in contact with the seat.",
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
  ],
});
