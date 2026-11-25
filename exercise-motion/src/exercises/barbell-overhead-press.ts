import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Strict press: bar in the hands at the clavicle, elbows about 45° out, legs quiet. */
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
  "wrist.dev": 2,
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
  "wrist.dev": 0,
};

export const spec = buildExerciseSpec({
  id: "barbell-overhead-press",
  catalogId: "1a05c6f170d880c5ad11c99b302b1bf9",
  name: "Barbell Overhead Press",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 1.1, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 12, balanceZ: 0.1, rack: { hookY: 1.38, safetyY: 1.15 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.32,
    anchor: "press",
    path: { startY: 1.46, startZ: 0.14, endY: 2.02, endZ: 0.1, arcBulgeZ: 0.035 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM, "neck.flex": 14 },
    end: { ...TRUNK, ...ARMS_TOP, "neck.flex": -4, "root.pitch": 3 },
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
    checkFeetPlanted("Squeeze your glutes and quads from now until you finish your last rep."),
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
      "Press the bar upward with as close to a straight bar path as you can perform.",
      "press_L",
      "y",
      0.4,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders flex and abduct",
      "Primary joint actions are shoulder abduction and shoulder flexion.",
      "shoulder_L.elev",
      70,
    ),
  ],
});
