import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box, cylinder } from "../equipment";
import { checkJointRange, checkJointWithinAt, plantBothToes } from "../postures";
import { keepAbove, lockAngle, pin } from "../solver";

const ARMS = {
  "clavicle.elev": 8,
  "clavicle.prot": 6,
  "shoulder.elev": 78,
  "shoulder.plane": 68,
  "shoulder.twist": 10,
  "elbow.flex": 28,
  "forearm.pron": 30,
  "wrist.flex": 4,
};

/** Tall, hips open, heels down-ish but already on the balls so the knees can travel forward. */
const TALL = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.98,
  "root.z": 0.02,
  "root.pitch": -4,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 12,
  "ankle.dorsi": -10,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

/** Knees driven forward, torso leaned back, thigh and trunk still one line, heels up. */
const DEEP = {
  ...TALL,
  "root.y": 0.62,
  "root.z": -0.16,
  "root.pitch": -42,
  "hip.flex": 6,
  "knee.flex": 118,
  "ankle.dorsi": -16,
  "elbow.flex": 12,
  "shoulder.elev": 88,
};

const BAR = new Vector3(0, 1.12, 0.58);

export const spec = buildExerciseSpec({
  id: "sissy-squat",
  catalogId: "1a25c6f170d880e9a081d306d6073583",
  name: "Sissy Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Deep", "Rise", "Tall"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.8, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "none" },
  extraEquipment: [
    box("sissy.postL", [0.38, 0.78, 0.58], [0.05, 1.56, 0.05], "steel", false),
    box("sissy.postR", [-0.38, 0.78, 0.58], [0.05, 1.56, 0.05], "steel", false),
    cylinder("sissy.bar", [0, BAR.y, BAR.z], 0.016, 0.72, "chrome", undefined, false),
  ],
  ground: "ballIn_L",
  stiffness: { hip: 10, lumbar: 12, thoracic: 10, knee: 1.4, ankle: 4, elbow: 3 },
  hints: { start: TALL, end: DEEP },
  extraGoals: (body) => [
    ...plantBothToes(body, 0.12, 0.06, 0.075, 52),
    keepAbove(body, "heel_L", 0.02, 24),
    keepAbove(body, "heel_R", 0.02, 24),
    lockAngle(body, "hip_L.flex", 6, 32),
    lockAngle(body, "hip_R.flex", 6, 32),
    lockAngle(body, "lumbar.flex", 2, 16),
    pin(body, "grip_L", () => new Vector3(0.16, BAR.y, BAR.z), 28),
    pin(body, "grip_R", () => new Vector3(-0.16, BAR.y, BAR.z), 28),
  ],
  checks: () => [
    checkJointWithinAt(
      "tall-start",
      "Starts upright on the balls of the feet",
      "Stand upright close to the support, hips open, ready to let the heels rise.",
      "knee_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "knees-forward",
      "Knees bend as the torso leans back",
      "Push the knees forward and lean the torso back, weight on the balls of the feet.",
      "knee_L.flex",
      "peak",
      90,
      145,
    ),
    checkJointWithinAt(
      "line",
      "Thighs stay aligned with the torso",
      "Keep the hips open so a straight line runs from the knee through the hip to the shoulder.",
      "hip_L.flex",
      "peak",
      -10,
      22,
    ),
    checkJointWithinAt(
      "back-neutral",
      "Lower back stays near neutral",
      "Keep the back near the same neutral position you use when standing upright.",
      "lumbar.flex",
      "peak",
      -10,
      16,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend and straighten as one unit",
      "Straighten the knees to lift the thighs and torso together back to upright.",
      "knee_L.flex",
      55,
    ),
  ],
});
