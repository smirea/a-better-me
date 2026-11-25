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

const LEG = { "hip.flex": 63, "hip.abd": 8, "hip.rot": 2, "ankle.dorsi": -8 };
const BOTH_BENT = sidedHints("L", { ...LEG, "knee.flex": 108 }, { ...LEG, "knee.flex": 108 }, SEATED);
const BOTH_STRAIGHT = sidedHints("L", { ...LEG, "knee.flex": 6 }, { ...LEG, "knee.flex": 6 }, SEATED);
const LOWER_ONE = sidedHints("L", { ...LEG, "knee.flex": 6 }, { ...LEG, "knee.flex": 108 }, SEATED);
const DOWN_ONE = sidedHints("L", { ...LEG, "knee.flex": 108 }, { ...LEG, "knee.flex": 108 }, SEATED);

export const spec = buildExerciseSpec({
  id: "accentuated-eccentric-leg-extension",
  catalogId: "2a25c6f170d88052ace5faa69e5a6fbc",
  name: "Accentuated Eccentric Leg Extension",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Raise", "Straight", "Lower", "Bend"],
  tempo: { lower: 2.8, bottom: 0.2, raise: 1.2, top: 0.25 },
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
    width: 0.5,
    radius: 0.055,
    trackAnchors: ["shinFront_L"],
    localOffset: [0, 0, 0.055],
    pulley: PULLEY,
  },
  hints: { start: BOTH_BENT, end: BOTH_STRAIGHT },
  waypoints: [
    { hints: BOTH_BENT, duration: 0.3, hold: 0.15 },
    { hints: BOTH_STRAIGHT, duration: 1.15, hold: 0.2 },
    { hints: LOWER_ONE, duration: 1.35, hold: 0.15 },
    { hints: DOWN_ONE, duration: 2.6, hold: 0.2 },
  ],
  loopMode: "cycle",
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
      "Both knees start bent",
      "Begin each rep with both knees bent and both shins behind the pad.",
      "knee_L.flex",
      "start",
      90,
      130,
    ),
    checkJointWithinAt(
      "both-straight",
      "Both knees straighten on the way up",
      "Lift the shin pad by straightening both knees.",
      "knee_R.flex",
      "peak",
      0,
      20,
    ),
    checkJointRange(
      "working-rom",
      "Working knee lowers the pad alone",
      "After both knees straighten, pull one leg off the pad and lower with the other leg.",
      "knee_L.flex",
      80,
    ),
    {
      id: "one-leg-lower",
      label: "One leg peels off before the lower",
      cue: "Fully bend one knee to pull that leg away from the shin pad, then lower with the other leg.",
      evaluate: ({ angles }) => {
        let found = false;
        for (const a of angles) {
          if (deg(a["knee_L.flex"]) < 22 && deg(a["knee_R.flex"]) > 70) found = true;
        }
        return { pass: found, measured: found ? "free leg leaves the pad at the top" : "both legs stayed together" };
      },
    },
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
