import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "hip.flex": 8,
  "knee.flex": 3,
  "ankle.dorsi": 1,
};

export const spec = buildExerciseSpec({
  id: "standing-barbell-behind-the-neck-overhead-press",
  catalogId: "1a05c6f170d880e38c76ff16887b6f82",
  name: "Standing Barbell Behind-The-Neck Overhead Press",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Neck"],
  tempo: { lower: 1.15, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 10, balanceZ: 0.1, rack: { hookY: 1.38, safetyY: 1.12 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.36,
    anchor: "press",
    path: { startY: 1.5, startZ: 0.04, endY: 2.02, endZ: 0.08, arcBulgeZ: -0.02 },
  },
  hints: {
    start: {
      ...TRUNK,
      "neck.flex": 18,
      "clavicle.elev": 8,
      "clavicle.prot": -10,
      "shoulder.elev": 92,
      "shoulder.plane": 4,
      "shoulder.twist": -6,
      "elbow.flex": 88,
      "forearm.pron": 74,
      "wrist.flex": 4,
    },
    end: {
      ...TRUNK,
      "neck.flex": 2,
      "clavicle.elev": 18,
      "clavicle.prot": -2,
      "shoulder.elev": 166,
      "shoulder.plane": 12,
      "shoulder.twist": 0,
      "elbow.flex": 6,
      "forearm.pron": 70,
      "wrist.flex": 2,
    },
  },
  stiffness: { knee: 2.8, elbow: 3.2, shoulder: 1.3 },
  extraContacts: { bar: { head: 0.05, neck: 0.035, girdle: 0.04, upperarm_L: 0.05, upperarm_R: 0.05 } },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 22),
    lockAngle(body, "knee_R.flex", 6, 22),
    ({ frame, push }) => {
      const chest = anchorPoint(body, frame, "sternum");
      const pelvis = anchorPoint(body, frame, "pelvisFront");
      push(22 * (chest.z - pelvis.z + 0.02));
      push(28 * (pelvis.z - 0.22));
    },
  ],
  checks: () => [
    checkFlatBack(
      "Do not lean back any further or excessively arch your lower back. Your lower back should stay locked in the same position.",
      18,
    ),
    checkFeetPlanted("Set your feet approximately shoulder-width apart."),
    checkJointWithinAt(
      "bar-behind-neck",
      "Bar lowers behind the neck",
      "Lower the bar behind your head through the range of motion that your shoulder mobility comfortably permits.",
      "shoulder_L.plane",
      "start",
      -35,
      40,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Press the bar up until you have fully straightened your elbows with the bar overhead.",
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
      "Bar travels upward from the neck",
      "In a slow and controlled manner, lower the bar behind your head.",
      "press_L",
      "y",
      0.35,
    ),
    checkJointRange(
      "abduction",
      "Shoulders abduct",
      "The primary joint action is shoulder abduction.",
      "shoulder_L.elev",
      50,
    ),
  ],
});
