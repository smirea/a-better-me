import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

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

export const spec = buildExerciseSpec({
  id: "pause-front-squat",
  catalogId: "2175c6f170d88016a63deff6b692c180",
  name: "Pause Front Squat",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lower", "Pause", "Stand", "Top"],
  tempo: { lower: 2, bottom: 1.6, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
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
    checkFlatBack("Maintain a mostly upright torso position with your back flat."),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full front-squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 65),
    checkJointWithinAt("pause-depth", "Paused in the bottom", "Once you reach the bottom of your front squat, pause in that position, remaining completely stationary.", "knee_L.flex", "peak", 95, 140),
    checkJointWithinAt("elbows-up", "Elbows stay up through the pause", "Squat down while keeping your chest and elbows up.", "shoulder_L.elev", "peak", 60, 120),
  ],
});
