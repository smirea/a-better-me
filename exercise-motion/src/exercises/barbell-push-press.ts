import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import type { Goal } from "../solver";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

function pinBar(y: number, z: number): Goal {
  return ({ body, q, push }) => {
    const i = body.dofCount;
    push(52 * (q[i] - y));
    push(52 * (q[i + 1] - z));
  };
}

const STAND_ARMS = {
  "clavicle.elev": 8,
  "clavicle.prot": -4,
  "shoulder.elev": 58,
  "shoulder.plane": 62,
  "shoulder.twist": 14,
  "elbow.flex": 108,
  "forearm.pron": 55,
  "wrist.flex": 18,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -2,
  "thoracic.flex": 0,
  "neck.flex": 10,
  "hip.flex": 6,
  "knee.flex": 6,
  "ankle.dorsi": 2,
  ...STAND_ARMS,
};

const DIP = {
  ...STAND,
  "root.y": 0.84,
  "root.pitch": 4,
  "hip.flex": 28,
  "knee.flex": 32,
  "ankle.dorsi": 14,
  "neck.flex": 16,
};

const LOCKOUT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -2,
  "neck.flex": -4,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
  "clavicle.elev": 18,
  "clavicle.prot": 4,
  "shoulder.elev": 168,
  "shoulder.plane": 16,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 62,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "barbell-push-press",
  catalogId: "1a05c6f170d8802d9233da6c4897b8e7",
  name: "Barbell Push Press",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Dip", "Drive", "Lower", "Rack"],
  loopMode: "cycle",
  station: {
    kind: "standing",
    stanceX: 0.17,
    toeOutDeg: 14,
    trackKnees: 10,
    balanceZ: 0.08,
    rack: { hookY: 1.38, safetyY: 0.85 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.3,
    anchor: "press",
    path: { startY: 1.44, startZ: 0.16, endY: 2.02, endZ: 0.08, arcBulgeZ: 0.05 },
  },
  hints: { start: STAND, end: LOCKOUT },
  waypoints: [
    { hints: STAND, extras: [1.44, 0.12], goals: [pinBar(1.44, 0.12)], duration: 1.2, hold: 0.25 },
    { hints: DIP, extras: [1.32, 0.12], goals: [pinBar(1.32, 0.12)], duration: 0.55, hold: 0.08 },
    { hints: LOCKOUT, extras: [2.0, 0.1], goals: [pinBar(2.0, 0.1)], duration: 1.35, hold: 0.28 },
  ],
  extraContacts: { bar: { head: 0.045, chest: 0.04, neck: 0.025 } },
  checks: () => [
    checkFlatBack(
      "Throughout the exercise, keep your lower back near a neutral position, like when you are normally standing upright, as you avoid excessively arching your lower back.",
    ),
    checkFeetPlanted("Keep the soles of your feet fully in contact with the ground during this dip phase."),
    checkJointRange(
      "knee-dip",
      "Knees dip before the drive",
      "Mildly bend your knees to dip down while maintaining an upright torso position and keeping your chest and elbows up.",
      "knee_L.flex",
      18,
    ),
    checkJointWithinAt(
      "dip-depth",
      "Quarter-squat dip",
      "The dip should resemble a quarter squat but without any of the forward trunk lean that occurs when squatting.",
      "knee_L.flex",
      "peak",
      22,
      50,
    ),
    checkJointRange(
      "elbows-locked",
      "Elbows lock out overhead",
      "Continue explosively pressing the bar upward until you have fully straightened your elbows with the bar overhead.",
      "elbow_L.flex",
      70,
    ),
    checkJointRange(
      "overhead-lockout",
      "Bar finishes overhead",
      "At the top, you ideally should be able to draw a straight line down from the bar that passes through your shoulders, hips, knees, and the middle of your feet.",
      "shoulder_L.elev",
      80,
    ),
  ],
});
