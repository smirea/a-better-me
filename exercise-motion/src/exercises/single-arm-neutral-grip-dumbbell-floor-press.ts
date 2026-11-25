import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -86,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 6,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 6,
  "ankle.dorsi": 2,
  "clavicle.prot": -14,
  "clavicle.elev": -2,
};

const PRESS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 58,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 2,
  "wrist.flex": -4,
  "clavicle.prot": -14,
  "clavicle.elev": -2,
};

const PRESS_BOTTOM = {
  "shoulder.elev": 50,
  "shoulder.plane": 18,
  "shoulder.twist": 2,
  "elbow.flex": 80,
  "forearm.pron": 4,
  "wrist.flex": -4,
  "clavicle.prot": -14,
  "clavicle.elev": -2,
};

const FREE = {
  "shoulder.elev": 22,
  "shoulder.plane": 18,
  "shoulder.twist": 4,
  "elbow.flex": 90,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.prot": -4,
  "clavicle.elev": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-neutral-grip-dumbbell-floor-press",
  catalogId: "24b5c6f170d880beb6cdfb1ffe89cddd",
  name: "Single Arm Neutral Grip Dumbbell Floor Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Elbow down"],
  tempo: { lower: 1.6, bottom: 0.35, raise: 0.9, top: 0.4 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
  },
  apparatus: {
    kind: "dumbbells",
    sides: ["L"],
    anchor: "press",
    handPath: { start: [0.28, 0.68, -0.42], end: [0.3, 0.42, -0.28] },
  },
  hints: {
    start: { ...TRUNK, ...sidedHints("L", PRESS_TOP, FREE) },
    end: { ...TRUNK, ...sidedHints("L", PRESS_BOTTOM, FREE) },
  },
  stiffness: { shoulder: 0.75, elbow: 4, forearm: 3, hip: 3, knee: 4, lumbar: 4, clavicle: 3 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 30),
    lockAngle(body, "knee_R.flex", 6, 30),
    pin(body, "heel_L", () => new Vector3(0.14, 0.02, 0.78), 22),
    pin(body, "heel_R", () => new Vector3(-0.14, 0.02, 0.78), 22),
  ],
  extraKeyGoals: (body) => ({
    end: [pin(body, "elbowTip_L", () => new Vector3(0.26, 0.05, -0.02), 22, "y")],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbow-locked",
      "Working elbow locked out",
      "Press until the working elbow is straight with the palm still in.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palm stays facing in",
      "Keep a neutral grip while the elbow stops on the floor.",
      "forearm_L.pron",
      "peak",
      -18,
      22,
    ),
    checkJointWithinAt(
      "short-rom",
      "Elbow stops on the floor",
      "Stop when the tucked upper arm meets the floor.",
      "elbow_L.flex",
      "peak",
      55,
      105,
    ),
    checkAnchorTravel(
      "dumbbell-rises",
      "Dumbbell leaves the floor-press bottom",
      "Press up from the elbow-on-floor position.",
      "press_L",
      "y",
      0.08,
    ),
  ],
});
