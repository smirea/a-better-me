import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";

/** Supine on a mat, legs long, elbows stop when the upper arms meet the floor. */
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
  "shoulder.plane": 68,
  "shoulder.twist": 28,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 48,
  "shoulder.plane": 12,
  "shoulder.twist": 14,
  "elbow.flex": 82,
  "forearm.pron": 36,
  "wrist.flex": -6,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-floor-press",
  catalogId: "1a05c6f170d880e2b66afebd843e3b9f",
  name: "Dumbbell Floor Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Elbows down"],
  tempo: { lower: 1.6, bottom: 0.35, raise: 0.9, top: 0.45 },
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    stanceX: 0.14,
    heelZ: 0.78,
    feetOnFloor: false,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, hip: 3, knee: 4, lumbar: 4, clavicle: 3 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 36),
    lockAngle(body, "knee_R.flex", 6, 36),
    pin(body, "heel_L", () => new Vector3(0.14, 0.02, 0.78), 24),
    pin(body, "heel_R", () => new Vector3(-0.14, 0.02, 0.78), 24),
  ],
  extraKeyGoals: (body) => ({
    end: [
      pin(body, "elbowTip_L", () => new Vector3(0.32, 0.05, -0.04), 24, "y"),
      pin(body, "elbowTip_R", () => new Vector3(-0.32, 0.05, -0.04), 24, "y"),
    ],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Press until the elbows are straight and the dumbbells are over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      34,
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
      "dumbbells-rise",
      "Dumbbells leave the floor-press bottom",
      "Press up from the elbows-on-floor position.",
      "press_L",
      "y",
      0.1,
    ),
  ],
});
