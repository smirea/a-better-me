import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const START_Y = 1.45;

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -3,
  "hip.flex": 4,
  "knee.flex": 3,
  "ankle.dorsi": 1,
};

export const spec = buildExerciseSpec({
  id: "overhead-low-pin-press",
  catalogId: "1a05c6f170d88088ab96e4088b138949",
  name: "Overhead Low Pin Press",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "On pins"],
  tempo: { lower: 1.05, bottom: 0.25, raise: 1.4, top: 2 },
  station: {
    kind: "standing",
    stanceX: 0.17,
    toeOutDeg: 10,
    balanceZ: 0.1,
    rack: { hookY: 1.38, safetyY: START_Y - 0.02 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.32,
    anchor: "press",
    path: { startY: START_Y, startZ: 0.14, endY: 2.02, endZ: 0.1, arcBulgeZ: 0.035 },
  },
  hints: {
    start: {
      ...TRUNK,
      "neck.flex": 14,
      "clavicle.elev": 6,
      "clavicle.prot": -6,
      "shoulder.elev": 74,
      "shoulder.plane": 42,
      "shoulder.twist": 12,
      "elbow.flex": 90,
      "forearm.pron": 72,
      "wrist.flex": 6,
    },
    end: {
      ...TRUNK,
      "neck.flex": -4,
      "root.pitch": 2,
      "clavicle.elev": 18,
      "clavicle.prot": 4,
      "shoulder.elev": 168,
      "shoulder.plane": 18,
      "shoulder.twist": 8,
      "elbow.flex": 6,
      "forearm.pron": 68,
      "wrist.flex": 4,
    },
  },
  stiffness: { knee: 2.6, elbow: 3.4, shoulder: 1.15 },
  extraContacts: { bar: { head: 0.045, chest: 0.04 } },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 22),
    lockAngle(body, "knee_R.flex", 6, 22),
    ({ frame, push }) => {
      const chest = anchorPoint(body, frame, "sternum");
      const pelvis = anchorPoint(body, frame, "pelvisFront");
      push(24 * (chest.z - pelvis.z - 0.02));
      push(28 * (pelvis.z - 0.18));
    },
  ],
  checks: () => [
    checkFlatBack(
      "Do not lean back any further or excessively arch your lower back. Your lower back should stay locked in the same position throughout your rep.",
      16,
    ),
    checkFeetPlanted("The middle of your feet should be under the bar, and your knees should be straight."),
    checkJointWithinAt(
      "starts-at-collarbone",
      "Bar starts near the collarbone",
      "Ideally, the pins should allow the bar to start below your chin.",
      "shoulder_L.elev",
      "start",
      25,
      95,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "While keeping your legs straight, press the bar upward with as close to a straight bar path as you can perform.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Finish the press with your elbows straightened as the bar is overhead.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkAnchorTravel(
      "bar-leaves-pins",
      "Bar leaves the pins",
      "Once the bar contacts the pins, allow the weight to transmit fully into the pins.",
      "press_L",
      "y",
      0.4,
    ),
  ],
});
