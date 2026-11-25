import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { stabilityBall } from "../equipment-library";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Forearm plank on the ball: one line from heels through the shoulders. */
const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.62,
  "root.z": -0.08,
  "root.pitch": 82,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 4,
  "ankle.dorsi": 10,
  "clavicle.prot": 12,
  "clavicle.elev": 4,
  "shoulder.elev": 92,
  "shoulder.plane": 84,
  "shoulder.twist": 16,
  "elbow.flex": 92,
  "forearm.pron": 70,
  "wrist.flex": -20,
};

const FORWARD = {
  ...PLANK,
  "shoulder.elev": 96,
  "shoulder.plane": 88,
};

const LEFT = {
  ...PLANK,
  "shoulder_L.elev": 96,
  "shoulder_L.plane": 78,
  "shoulder_R.elev": 92,
  "shoulder_R.plane": 90,
};

const BACK = {
  ...PLANK,
  "shoulder.elev": 92,
  "shoulder.plane": 74,
};

export const spec = buildExerciseSpec({
  id: "stir-the-pot",
  catalogId: "1a45c6f170d880c3b79fd117e32228d8",
  name: "Stir The Pot",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  brace: true,
  phaseLabels: ["Set", "Stir", "Circle", "Return"],
  loopMode: "cycle",
  station: {
    kind: "pushup",
    forearmsOnFloor: true,
    handX: 0.16,
    handZ: 0.44,
    handElevationY: 0.56,
    handSupport: "none",
    feetElevationY: 0.05,
    footZ: -0.78,
    footX: 0.11,
  },
  extraEquipment: stabilityBall(0.3, [0, 0.44]),
  extraContacts: {
    "ball.body": {
      forearm_L: 0.08,
      forearm_R: 0.08,
      hand_L: 0.1,
      hand_R: 0.1,
      upperarm_L: 0.04,
      upperarm_R: 0.04,
    },
    "pushup.handBox": { upperarm_L: 0.05, upperarm_R: 0.05, forearm_L: 0.05, forearm_R: 0.05 },
  },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "forearmMid_L", bodyweightShare: 0.28, grip: "press", direction: [0, 1, 0] },
      { anchor: "forearmMid_R", bodyweightShare: 0.28, grip: "press", direction: [0, 1, 0] },
    ],
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, shoulder: 0.8, elbow: 4 },
  hints: { start: PLANK, end: FORWARD },
  waypoints: [
    { hints: PLANK, duration: 0.7, hold: 0.05 },
    { hints: FORWARD, duration: 0.7, hold: 0.05 },
    { hints: LEFT, duration: 0.7, hold: 0.05 },
    { hints: BACK, duration: 0.7, hold: 0.05 },
  ],
  checks: () => [
    checkFlatBack(
      "Tighten the abs and squeeze the glutes so you can draw a straight line from the legs through the hips to the shoulders. Do not let the hips or chest sag.",
      10,
    ),
    checkNeutralNeck("Keep the neck near a neutral position, like you would normally do when standing upright."),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows stay bent on the ball",
      "Position the bent elbows on top of the ball about shoulder width apart, with the shoulders stacked above the elbows.",
      "elbow_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees stay straight in the plank",
      "Walk the legs back until the knees are fully straightened, with the toes dug into the ground.",
      "knee_L.flex",
      "start",
      -6,
      18,
    ),
    checkJointWithinAt(
      "hips-level",
      "Hips stay up in the plank",
      "Keep the hips held up rather than letting them sag, which would arch the lower back.",
      "lumbar.flex",
      "peak",
      -4,
      28,
    ),
  ],
});
