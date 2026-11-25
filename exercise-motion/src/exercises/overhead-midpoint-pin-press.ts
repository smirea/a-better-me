import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const START_Y = 1.65;

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 3,
};

export const spec = buildExerciseSpec({
  id: "overhead-midpoint-pin-press",
  catalogId: "24d5c6f170d88067843cdd576ae017c7",
  name: "Overhead Midpoint Pin Press",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "On pins"],
  tempo: { lower: 0.9, bottom: 0.25, raise: 1.2, top: 2 },
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
    path: { startY: START_Y, startZ: 0.13, endY: 2.02, endZ: 0.1, arcBulgeZ: 0.03 },
  },
  hints: {
    start: {
      ...TRUNK,
      "neck.flex": 16,
      "clavicle.elev": 12,
      "clavicle.prot": -2,
      "shoulder.elev": 112,
      "shoulder.plane": 32,
      "shoulder.twist": 10,
      "elbow.flex": 58,
      "forearm.pron": 70,
      "wrist.flex": 6,
    },
    end: {
      ...TRUNK,
      "neck.flex": -4,
      "root.pitch": 2,
      "clavicle.elev": 18,
      "clavicle.prot": 4,
      "shoulder.elev": 168,
      "shoulder.plane": 16,
      "shoulder.twist": 8,
      "elbow.flex": 6,
      "forearm.pron": 68,
      "wrist.flex": 4,
    },
  },
  stiffness: { knee: 2.6, elbow: 3.2, shoulder: 1.2 },
  extraContacts: { bar: { head: 0.05 } },
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
    checkFeetPlanted("The middle of your feet should be under the bar, and your knees should be straight."),
    checkJointWithinAt(
      "starts-at-forehead",
      "Bar starts near forehead height",
      "Situating the pins reasonably close to forehead height will allow them to begin this exercise within the middle third of the range of a standard overhead press.",
      "shoulder_L.elev",
      "start",
      60,
      140,
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
      "partial-press",
      "Press from the midpoint",
      "This exercise can improve overhead press strength from the midpoint of the press through the lockout.",
      "press_L",
      "y",
      0.22,
    ),
  ],
});
