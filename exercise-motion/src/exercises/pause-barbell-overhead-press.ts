import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -3,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 6,
  "clavicle.prot": -6,
  "shoulder.elev": 72,
  "shoulder.plane": 42,
  "shoulder.twist": 12,
  "elbow.flex": 92,
  "forearm.pron": 72,
  "wrist.flex": 8,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 4,
  "shoulder.elev": 168,
  "shoulder.plane": 18,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 68,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "pause-barbell-overhead-press",
  catalogId: "24d5c6f170d880e19102db0e4a0cb942",
  name: "Pause Barbell Overhead Press",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 1.15, bottom: 0.3, raise: 1.6, top: 2 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 12, balanceZ: 0.1, rack: { hookY: 1.38, safetyY: 1.15 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.32,
    anchor: "press",
    path: { startY: 1.46, startZ: 0.14, endY: 2.02, endZ: 0.1, arcBulgeZ: 0.035 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM, "neck.flex": 14 },
    end: { ...TRUNK, ...ARMS_TOP, "neck.flex": -4, "root.pitch": 2 },
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
    checkFeetPlanted("This will create a stable platform from which to press."),
    checkJointWithinAt(
      "pause-on-collarbone",
      "Paused on the collarbone",
      "Once the bar is on your collarbone, pause in that position as you remain completely stationary for a brief period of time.",
      "elbow_L.flex",
      "start",
      70,
      130,
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
    checkJointWithinAt(
      "overhead-lockout",
      "Bar finishes overhead",
      "You should be able to draw a straight line down from the bar that passes through your shoulders, hips, knees, and the middle of your feet.",
      "shoulder_L.elev",
      "peak",
      135,
      175,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels upward",
      "While keeping your legs straight, press the bar upward with as close to a straight bar path as you can perform.",
      "press_L",
      "y",
      0.4,
    ),
    checkJointWithinAt(
      "no-leg-drive",
      "Knees stay quiet",
      "Avoid using your legs to help with driving the bar up. This is not a push press.",
      "knee_L.flex",
      "start",
      0,
      14,
    ),
  ],
});
