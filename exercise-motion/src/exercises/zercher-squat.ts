import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Bar sits in the elbow crooks, elbows bent tightly in front of the torso. */
const ARMS = {
  "clavicle.elev": 4,
  "clavicle.prot": 6,
  "shoulder.elev": 48,
  "shoulder.plane": 72,
  "shoulder.twist": 20,
  "elbow.flex": 128,
  "forearm.pron": -25,
  "wrist.flex": 6,
  "wrist.dev": 0,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.54,
  "root.z": -0.04,
  "root.pitch": 16,
  "hip.flex": 108,
  "hip.abd": 18,
  "hip.rot": 10,
  "knee.flex": 116,
  "ankle.dorsi": 24,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "zercher-squat",
  catalogId: "1a25c6f170d8808d85ace5605ff5b35e",
  name: "Zercher Squat",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.08,
    anchor: "grip",
    alignWrists: false,
    path: { startY: 1.12, startZ: 0.22, endY: 0.72, endZ: 0.28 },
  },
  hints: { start: STAND, end: BOTTOM },
  extraContacts: { bar: { forearm_L: 0.045, forearm_R: 0.045, chest: 0.04 } },
  extraGoals: (body) => [
    ({ frame, q, push }) => {
      const y = q[body.dofCount];
      const z = q[body.dofCount + 1];
      for (const name of ["elbowTip_L", "elbowTip_R"] as const) {
        const p = anchorPoint(body, frame, name);
        push(42 * (p.y - y));
        push(42 * (p.z - (z - 0.02)));
      }
    },
  ],
  checks: () => [
    checkFlatBack("Aim to keep your torso mostly upright, with your back flat and chest up."),
    checkNeutralNeck("In the starting position, your neck should be near a neutral position. Keep your neck in this position throughout your set."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 85),
    checkJointWithinAt("elbows-hooked", "Elbows stay bent under the bar", "Keep the bar close to your torso with your bent elbows hooked under it throughout your set.", "elbow_L.flex", "peak", 100, 145),
    checkJointWithinAt("upright", "Mostly upright torso", "As you descend, it is natural for your torso to lean forward mildly, but aim to keep your torso mostly upright.", "thoracic.flex", "peak", -10, 20),
  ],
});
