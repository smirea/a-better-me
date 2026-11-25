import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Full clean grip: fingers wrapped under the shaft, upper arms level, elbows forward. */
const ARMS = {
  "clavicle.elev": 2,
  "clavicle.prot": -4,
  "shoulder.elev": 70,
  "shoulder.plane": 50,
  "shoulder.twist": 10,
  "elbow.flex": 128,
  "forearm.pron": -70,
  "wrist.flex": 22,
  "wrist.dev": 6,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.55,
  "root.z": -0.02,
  "root.pitch": 14,
  "hip.flex": 108,
  "hip.abd": 18,
  "hip.rot": 10,
  "knee.flex": 120,
  "ankle.dorsi": 26,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "full-hand-clean-grip-front-squat",
  catalogId: "1a25c6f170d880068daae293704193e0",
  name: "Full Hand Clean Grip Front Squat",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.2,
    anchor: "grip",
    path: { startY: 1.52, startZ: 0.18, endY: 1.02, endZ: 0.2 },
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 5, shoulder: 2.6, wrist: 3.4, forearm: 2.4 },
  extraContacts: { bar: { girdle: 0.03, neck: 0.02, chest: 0.03, forearm_L: 0.035, forearm_R: 0.035 } },
  extraGoals: (body) => [
    ({ frame, q, angles, push }) => {
      const y = q[body.dofCount];
      const z = q[body.dofCount + 1];
      for (const name of ["frontRack_L", "frontRack_R"] as const) {
        const p = anchorPoint(body, frame, name);
        push(8 * (p.y - y));
        push(8 * (p.z - (z - 0.015)));
      }
      const elev = (70 * Math.PI) / 180;
      const elbow = (126 * Math.PI) / 180;
      push(12 * (angles["shoulder_L.elev"] - elev));
      push(12 * (angles["shoulder_R.elev"] - elev));
      push(14 * (angles["elbow_L.flex"] - elbow));
      push(14 * (angles["elbow_R.flex"] - elbow));
      push(16 * (angles["wrist_L.flex"] - (20 * Math.PI) / 180));
      push(16 * (angles["wrist_R.flex"] - (20 * Math.PI) / 180));
      push(18 * angles["clavicle_L.elev"]);
      push(18 * angles["clavicle_R.elev"]);
      push(10 * (angles["shoulder_L.plane"] - (46 * Math.PI) / 180));
      push(10 * (angles["shoulder_R.plane"] - (46 * Math.PI) / 180));
    },
  ],
  checks: () => [
    checkFlatBack("Maintain a mostly upright torso position with your back flat."),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("full-hand", "Fingers stay wrapped under the bar", "For the full clean grip, wrap your fingers around the bar with the bar pressed into the bases of the fingers.", "elbow_L.flex", "peak", 100, 150),
    checkJointWithinAt("elbows-up", "Elbows point forward", "Lift your elbows until your upper arms are parallel to the ground.", "shoulder_L.elev", "peak", 60, 120),
  ],
});
