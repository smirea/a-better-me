import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Full-hand clean grip: upper arms level, elbows forward, fingers wrapped under the bar. */
const ARMS = {
  "clavicle.elev": 2,
  "clavicle.prot": -4,
  "shoulder.elev": 68,
  "shoulder.plane": 48,
  "shoulder.twist": 8,
  "elbow.flex": 124,
  "forearm.pron": -64,
  "wrist.flex": 16,
  "wrist.dev": 4,
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

const RACK = { kind: "standing" as const, stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } };

export const spec = buildExerciseSpec({
  id: "front-squat",
  catalogId: "28e5c6f170d88028a450c005a7a8cf60",
  name: "Front Squat",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: RACK,
  apparatus: {
    kind: "barbell",
    gripX: 0.22,
    anchor: "grip",
    path: { startY: 1.52, startZ: 0.18, endY: 1.02, endZ: 0.2 },
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 5, shoulder: 2.6, wrist: 3.2, forearm: 2.2 },
  extraContacts: { bar: { girdle: 0.03, neck: 0.02, chest: 0.03 } },
  extraGoals: (body) => [
    ({ frame, q, angles, push }) => {
      const y = q[body.dofCount];
      const z = q[body.dofCount + 1];
      for (const name of ["frontRack_L", "frontRack_R"] as const) {
        const p = anchorPoint(body, frame, name);
        push(8 * (p.y - y));
        push(8 * (p.z - (z - 0.015)));
      }
      const elev = (68 * Math.PI) / 180;
      const elbow = (118 * Math.PI) / 180;
      push(12 * (angles["shoulder_L.elev"] - elev));
      push(12 * (angles["shoulder_R.elev"] - elev));
      push(12 * (angles["elbow_L.flex"] - elbow));
      push(12 * (angles["elbow_R.flex"] - elbow));
      push(18 * angles["clavicle_L.elev"]);
      push(18 * angles["clavicle_R.elev"]);
      push(10 * (angles["shoulder_L.plane"] - (42 * Math.PI) / 180));
      push(10 * (angles["shoulder_R.plane"] - (42 * Math.PI) / 180));
    },
  ],
  checks: () => [
    checkFlatBack("Maintain a mostly upright torso position with your lower back flat."),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet."),
    checkJointRange("knee-depth", "Squat through a full range", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 65),
    checkJointWithinAt("elbows-up", "Elbows stay high", "While keeping your upper arms parallel to the ground, avoid dropping your elbows.", "shoulder_L.elev", "peak", 60, 120),
    checkJointWithinAt("clean-grip", "Fingers stay wrapped under the bar", "With the full hand clean grip, wrap your fingers around the bar and lift the elbows until the upper arms are parallel to the ground.", "elbow_L.flex", "peak", 90, 145),
  ],
});
