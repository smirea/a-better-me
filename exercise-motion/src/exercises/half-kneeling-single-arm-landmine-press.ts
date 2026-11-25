import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Right foot forward, left knee down. Left arm presses the landmine. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.74,
  "root.pitch": 3,
  "lumbar.flex": -3,
  "thoracic.flex": 0,
  "neck.flex": 0,
  "hip_R.flex": 92,
  "hip_R.abd": 0,
  "hip_R.rot": 6,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 32,
  "hip_L.abd": 0,
  "knee_L.flex": 100,
  "ankle_L.dorsi": -8,
};

const PRESS = {
  "clavicle.elev": 8,
  "clavicle.prot": -4,
  "shoulder.elev": 55,
  "shoulder.plane": 82,
  "shoulder.twist": 10,
  "elbow.flex": 102,
  "forearm.pron": 10,
  "wrist.flex": 0,
};

const LOCK = {
  "clavicle.elev": 20,
  "clavicle.prot": -2,
  "shoulder.elev": 136,
  "shoulder.plane": 74,
  "shoulder.twist": 0,
  "elbow.flex": 10,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const REST = {
  "clavicle.elev": 2,
  "shoulder.elev": 18,
  "shoulder.plane": 40,
  "elbow.flex": 22,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "half-kneeling-single-arm-landmine-press",
  catalogId: "3b15c6f170d880aebe45f5c3553357f4",
  name: "Half-Kneeling Single Arm Landmine Press",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulder"],
  station: { kind: "kneeling", halfKneelingSide: "R" },
  apparatus: { kind: "landmine", pivotZ: 1.65, sides: ["L"] },
  hints: {
    start: sidedHints("L", PRESS, REST, LEGS),
    end: sidedHints("L", LOCK, REST, LEGS),
  },
  stiffness: { elbow: 2.5, shoulder: 1.8, lumbar: 6 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const p = anchorPoint(body, frame, "grip_L");
      const dist = Math.hypot(p.x, p.y - 0.06, p.z - 1.65);
      push(26 * (dist - 1.95));
    },
    pin(body, "toe_L", () => new Vector3(0.14, 0.045, -0.56), 70),
    lockAngle(body, "lumbar.bend", 0, 18),
    lockAngle(body, "hip_L.abd", 0, 16),
    lockAngle(body, "hip_R.abd", 0, 16),
  ],
  checks: () => [
    checkJointRange("press-elbow", "Left arm presses the landmine", "Press the free end from the left shoulder until the elbow nearly straightens.", "elbow_L.flex", 60),
    checkJointWithinAt("start-elbow", "Starts at the shoulder", "Begin with the left elbow bent and the bar end at the front of the shoulder.", "elbow_L.flex", "start", 75, 125),
    checkJointWithinAt("lockout", "Left elbow extends", "Finish with the left elbow nearly straight, the bar angled up along the landmine.", "elbow_L.flex", "peak", 0, 28),
    checkJointWithinAt("shoulder-up", "Left shoulder flexes", "Drive the left shoulder into flexion as the bar rises.", "shoulder_L.elev", "peak", 130, 170),
    checkJointWithinAt("down-knee", "Back knee stays down", "Keep the left knee on the floor in the half-kneeling stance.", "knee_L.flex", "peak", 80, 130),
    checkJointWithinAt("front-knee", "Front shin stays vertical", "The right foot is forward with the knee bent near a right angle.", "knee_R.flex", "peak", 55, 115),
  ],
});
