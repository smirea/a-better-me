import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
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
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 88,
  "shoulder.plane": 70,
  "shoulder.twist": 30,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 48,
  "shoulder.plane": 10,
  "shoulder.twist": 14,
  "elbow.flex": 82,
  "forearm.pron": 36,
  "wrist.flex": -6,
};

export const spec = buildExerciseSpec({
  id: "barbell-floor-press",
  catalogId: "1a05c6f170d8802a950df7b6c710ffb4",
  name: "Barbell Floor Press",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Elbows down"],
  tempo: { lower: 1.6, bottom: 2, raise: 0.9, top: 0.45 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    stanceX: 0.14,
    heelZ: 0.72,
    feetOnFloor: false,
    rack: {},
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 0.68, startZ: -0.28, endY: 0.4, endZ: -0.12, arcBulgeZ: 0.03 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, hip: 3, knee: 4, lumbar: 4, clavicle: 3 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 36),
    lockAngle(body, "knee_R.flex", 6, 36),
    lockAngle(body, "ankle_L.dorsi", 2, 18),
    lockAngle(body, "ankle_R.dorsi", 2, 18),
    pin(body, "heel_L", () => new Vector3(0.14, 0.02, 0.78), 24),
    pin(body, "heel_R", () => new Vector3(-0.14, 0.02, 0.78), 24),
  ],
  extraKeyGoals: (body) => ({
    end: [
      pin(body, "elbowTip_L", () => new Vector3(0.32, 0.045, -0.05), 26, "y"),
      pin(body, "elbowTip_R", () => new Vector3(-0.32, 0.045, -0.05), 26, "y"),
    ],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Press until the elbows are straight and the bar is over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "short-rom",
      "Elbows stop on the floor",
      "Stop when the upper arms meet the floor, short of a full bench-press depth.",
      "elbow_L.flex",
      "peak",
      55,
      100,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar leaves the floor-press bottom",
      "Press up from the paused elbows-on-floor position.",
      "press_L",
      "y",
      0.12,
    ),
  ],
});
