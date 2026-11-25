import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { stabilityBall } from "../equipment-library";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, pin } from "../solver";

const BALL_R = 0.3;
const BALL_Z = 0.42;

/** Elbows on top of the ball, toes dug in, body in one line sloping down to the feet. */
const HOLD = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.42,
  "root.z": -0.05,
  "root.pitch": 58,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 8,
  "hip.abd": 6,
  "knee.flex": 10,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "clavicle.elev": 6,
  "shoulder.elev": 88,
  "shoulder.plane": 84,
  "shoulder.twist": 16,
  "elbow.flex": 92,
  "forearm.pron": 70,
  "wrist.flex": -20,
};

export const spec = buildExerciseSpec({
  id: "stability-ball-plank",
  catalogId: "2785c6f170d880e2a185cdf3fda20df9",
  name: "Stability Ball Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  brace: true,
  phaseLabels: ["Set", "Brace", "Hold", "Hold"],
  station: { kind: "cardio", machine: "none" },
  extraEquipment: stabilityBall(BALL_R, [0, BALL_Z]),
  extraContacts: {
    "ball.body": {
      forearm_L: 0.06,
      forearm_R: 0.06,
      upperarm_L: 0.05,
      upperarm_R: 0.05,
      hand_L: 0.05,
      hand_R: 0.05,
    },
  },
  extraRequired: [],
  extraGoals: (body) => [
    keepAbove(body, "ballIn_L", 0.02, 40),
    keepAbove(body, "ballIn_R", 0.02, 40),
    pin(body, "forearmMid_L", () => new Vector3(0.18, BALL_R * 2 - 0.06, BALL_Z), 54),
    pin(body, "forearmMid_R", () => new Vector3(-0.18, BALL_R * 2 - 0.06, BALL_Z), 54),
  ],
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_L", bodyweightShare: 0.28, grip: "press", direction: [0, 1, 0] },
      { anchor: "forearmMid_R", bodyweightShare: 0.28, grip: "press", direction: [0, 1, 0] },
    ],
  },
  stiffness: { hip: 8, lumbar: 12, thoracic: 10, shoulder: 8, elbow: 6 },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkFlatBack(
      "Tighten your abs and squeeze your glutes so you can draw a straight line from your legs through your hips to your shoulders.",
    ),
    checkNeutralNeck("Keep your neck near a neutral position like you would normally do when standing upright."),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows stay bent on the ball",
      "Position your bent elbows on top of the ball about shoulder width apart, with your shoulders above your elbows.",
      "elbow_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight",
      "Walk your legs back until your knees are fully straightened with the bottom of your toes dug into the ground.",
      "knee_L.flex",
      "start",
      -6,
      22,
    ),
  ],
});
