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
};

export const spec = buildExerciseSpec({
  id: "wide-grip-barbell-behind-the-neck-overhead-press",
  catalogId: "24f5c6f170d880ceb223d5626dbea9de",
  name: "Wide Grip Barbell Behind-The-Neck Overhead Press",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Neck"],
  tempo: { lower: 1.15, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 10, balanceZ: 0.1, rack: { hookY: 1.38, safetyY: 1.12 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.42,
    anchor: "press",
    path: { startY: 1.52, startZ: 0.05, endY: 2.02, endZ: 0.08, arcBulgeZ: -0.02 },
  },
  hints: {
    start: {
      ...TRUNK,
      "neck.flex": 16,
      "clavicle.elev": 10,
      "clavicle.prot": -8,
      "shoulder.elev": 100,
      "shoulder.plane": 6,
      "shoulder.twist": -4,
      "elbow.flex": 78,
      "forearm.pron": 76,
      "wrist.flex": 2,
    },
    end: {
      ...TRUNK,
      "neck.flex": 2,
      "clavicle.elev": 18,
      "clavicle.prot": 0,
      "shoulder.elev": 166,
      "shoulder.plane": 2,
      "shoulder.twist": 0,
      "elbow.flex": 8,
      "forearm.pron": 72,
      "wrist.flex": 2,
    },
  },
  stiffness: { knee: 2.8, elbow: 3.2, shoulder: 1.3 },
  extraContacts: { bar: { head: 0.05, neck: 0.035, girdle: 0.04 } },
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
      "wide-bottom",
      "Wide grip behind the neck",
      "Your elbows should naturally be flared out to a greater extent during this variation compared to your standard behind-the-neck press.",
      "elbow_L.flex",
      "start",
      55,
      130,
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
      "Bar travels upward",
      "Simultaneously arc the bar slightly backward while pressing it up.",
      "press_L",
      "y",
      0.32,
    ),
    checkJointRange(
      "abduction",
      "Shoulders abduct",
      "The primary joint action is shoulder abduction.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
