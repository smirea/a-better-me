import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import type { PadSurface } from "../equipment-library";
import { checkJointRange, checkJointWithinAt, restBackOnPad } from "../postures";
import { pin } from "../solver";

const SEAT_Y = 0.52;
const HINGE_Z = -0.06;
const BACK_DEG = -28;
const BACK_A = (BACK_DEG * Math.PI) / 180;

const BACK: PadSurface = {
  origin: [0, SEAT_Y, HINGE_Z],
  normal: [0, Math.cos(BACK_A), Math.sin(BACK_A)],
  up: [0, Math.sin(BACK_A), -Math.cos(BACK_A)],
};

const ROLL_Z = HINGE_Z + 0.51;
const ROLL_Y = SEAT_Y - 0.08;

const ARMS = {
  "shoulder.elev": 48,
  "shoulder.plane": 78,
  "shoulder.twist": 42,
  "elbow.flex": 128,
  "forearm.pron": 20,
  "wrist.flex": 6,
};

const DOWN = {
  "root.y": 0.62,
  "root.z": -0.02,
  "root.pitch": -112,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 6,
  "hip.flex": 14,
  "hip.abd": 8,
  "knee.flex": 16,
  "ankle.dorsi": 8,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.7,
  "root.z": 0.02,
  "root.pitch": -62,
  "lumbar.flex": 34,
  "thoracic.flex": 28,
  "neck.flex": 12,
  "hip.flex": 58,
};

export const spec = buildExerciseSpec({
  id: "decline-sit-up-with-hands-on-shoulders",
  catalogId: "1a35c6f170d880f99982e1202f87f00b",
  name: "Decline Sit-Up With Hands On Shoulders",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Curl up", "Sit", "Lower"],
  station: {
    kind: "seated",
    seatY: SEAT_Y,
    seatZ: -0.02,
    pinBack: false,
    feetMode: "hanging",
    passiveJoints: ["knee", "ankle", "clavicle", "wrist"],
    frame: {
      type: "adjustable-bench",
      backAngleDeg: BACK_DEG,
      seatTiltDeg: 0,
      hingeZ: HINGE_Z,
      ankleRollers: true,
    },
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 16, thoracic: 14, hip: 3 },
  extraContacts: {
    "bench.backPad": { pelvis: 0.06, abdomen: 0.04, chest: 0.04, girdle: 0.04, head: 0.03 },
    "bench.seatPad": { pelvis: 0.06, thigh_L: 0.05, thigh_R: 0.05 },
    "bench.rollerTop": { shank_L: 0.04, shank_R: 0.04, foot_L: 0.04, foot_R: 0.04 },
    "bench.spine": { chest: 0.04, abdomen: 0.04 },
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.11, ROLL_Y - 0.02, ROLL_Z), 28),
    pin(body, "heel_R", () => new Vector3(-0.11, ROLL_Y - 0.02, ROLL_Z), 28),
  ],
  extraKeyGoals: (body) => ({
    start: restBackOnPad(body, BACK, { sacrumAlong: null, upperBackAlong: 0.42, occiputAlong: 0.68, weight: 22 }),
  }),
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "Back rounds as the chest comes toward the thighs",
      "To train your abdominal muscles dynamically, your back should progressively round rather than remain in a flat position.",
      "lumbar.flex",
      16,
    ),
    checkJointRange(
      "full-sit-up",
      "The whole back lifts off the bench",
      "Given that this is a sit-up rather than a crunch, you will lift the entirety of your back off the bench.",
      "thoracic.flex",
      12,
    ),
    checkJointRange(
      "hips-help",
      "Hips flex as the chest approaches the thighs",
      "Bring your chest toward your thighs until you have fully rounded your back.",
      "hip_L.flex",
      20,
    ),
    checkJointWithinAt(
      "arms-crossed",
      "Hands stay on the shoulders",
      "Cross your arms across your chest and maintain this arm position throughout your set.",
      "elbow_L.flex",
      "peak",
      100,
      145,
    ),
  ],
});
