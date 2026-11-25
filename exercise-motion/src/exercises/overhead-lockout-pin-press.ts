import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const START_Y = 1.82;

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "neck.flex": 0,
  "hip.flex": 3,
  "knee.flex": 3,
};

export const spec = buildExerciseSpec({
  id: "overhead-lockout-pin-press",
  catalogId: "24d5c6f170d88004b249d5b21f2aa501",
  name: "Overhead Lockout Pin Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "On pins"],
  tempo: { lower: 0.7, bottom: 0.2, raise: 0.9, top: 2 },
  station: {
    kind: "standing",
    stanceX: 0.17,
    toeOutDeg: 8,
    balanceZ: 0.1,
    rack: { hookY: 1.38, safetyY: START_Y - 0.02 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.3,
    anchor: "press",
    path: { startY: START_Y, startZ: 0.06, endY: 2.05, endZ: 0.04, arcBulgeZ: 0.01 },
  },
  hints: {
    start: {
      ...TRUNK,
      "clavicle.elev": 16,
      "clavicle.prot": 2,
      "shoulder.elev": 148,
      "shoulder.plane": 14,
      "shoulder.twist": 6,
      "elbow.flex": 36,
      "forearm.pron": 68,
      "wrist.flex": 4,
    },
    end: {
      ...TRUNK,
      "clavicle.elev": 18,
      "clavicle.prot": 4,
      "shoulder.elev": 170,
      "shoulder.plane": 12,
      "shoulder.twist": 6,
      "elbow.flex": 6,
      "forearm.pron": 66,
      "wrist.flex": 2,
    },
  },
  stiffness: { knee: 3.2, elbow: 3.6, shoulder: 1.4 },
  extraContacts: { bar: { head: 0.04 } },
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
      18,
    ),
    checkFeetPlanted("Situate your feet near shoulder width apart with your knees straight."),
    checkJointWithinAt(
      "starts-above-head",
      "Bar starts above the head",
      "The pins should be higher than the top of your head.",
      "shoulder_L.elev",
      "start",
      90,
      168,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows finish straight",
      "Press the straight bar up until your elbows are fully straightened.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "short-shoulder-arc",
      "Short lockout arc",
      "This is intentionally a short range of motion variation.",
      "shoulder_L.elev",
      "peak",
      145,
      175,
    ),
    checkAnchorTravel(
      "lockout-travel",
      "Bar moves through the lockout",
      "The pins should generally allow you to press the bar at least 2in (5cm) up.",
      "press_L",
      "y",
      0.08,
    ),
  ],
});
