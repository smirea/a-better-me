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
  "shoulder.elev": 88,
  "shoulder.plane": 68,
  "shoulder.twist": 28,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const PRESS_BOTTOM = {
  "shoulder.elev": 48,
  "shoulder.plane": 12,
  "shoulder.twist": 14,
  "elbow.flex": 82,
  "forearm.pron": 36,
  "wrist.flex": -6,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const FREE = {
  "shoulder.elev": 24,
  "shoulder.plane": 20,
  "shoulder.twist": 6,
  "elbow.flex": 88,
  "forearm.pron": 12,
  "wrist.flex": 2,
  "clavicle.prot": -6,
  "clavicle.elev": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-floor-press",
  catalogId: "1a05c6f170d88086b7e3da51deb96425",
  name: "Single Arm Dumbbell Floor Press",
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
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: {
    start: { ...TRUNK, ...sidedHints("L", PRESS_TOP, FREE) },
    end: { ...TRUNK, ...sidedHints("L", PRESS_BOTTOM, FREE) },
  },
  stiffness: { shoulder: 0.7, elbow: 4, hip: 3, knee: 4, lumbar: 4, clavicle: 3 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 30),
    lockAngle(body, "knee_R.flex", 6, 30),
    pin(body, "heel_L", () => new Vector3(0.14, 0.02, 0.78), 22),
    pin(body, "heel_R", () => new Vector3(-0.14, 0.02, 0.78), 22),
  ],
  extraKeyGoals: (body) => ({
    end: [pin(body, "elbowTip_L", () => new Vector3(0.32, 0.05, -0.04), 24, "y")],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbow-locked",
      "Working elbow locked out",
      "Press until the working elbow is straight.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "short-rom",
      "Elbow stops on the floor",
      "Stop when the upper arm meets the floor.",
      "elbow_L.flex",
      "peak",
      55,
      100,
    ),
    checkAnchorTravel(
      "dumbbell-rises",
      "Dumbbell leaves the floor-press bottom",
      "Press up from the elbow-on-floor position.",
      "press_L",
      "y",
      0.1,
    ),
  ],
});
