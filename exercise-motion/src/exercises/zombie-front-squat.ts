import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hands-free: elbows locked, arms straight out in front, bar cradled on the delts. */
const ARMS = {
  "clavicle.elev": 2,
  "clavicle.prot": -4,
  "shoulder.elev": 68,
  "shoulder.plane": 48,
  "shoulder.twist": 6,
  "elbow.flex": 108,
  "forearm.pron": 24,
  "wrist.flex": 6,
  "wrist.dev": 0,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.55,
  "root.z": -0.02,
  "root.pitch": 12,
  "hip.flex": 106,
  "hip.abd": 18,
  "hip.rot": 10,
  "knee.flex": 118,
  "ankle.dorsi": 26,
  "ankle.inv": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "zombie-front-squat",
  catalogId: "2165c6f170d88097ba97ce6ce53902de",
  name: "Zombie Front Squat",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "grip",
    alignWrists: false,
    path: { startY: 1.52, startZ: 0.18, endY: 1.02, endZ: 0.2 },
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 6, shoulder: 2.4, wrist: 3 },
  extraGoals: (body) => [
    ({ frame, q, angles, push }) => {
      const y = q[body.dofCount];
      const z = q[body.dofCount + 1];
      for (const name of ["frontRack_L", "frontRack_R"] as const) {
        const p = anchorPoint(body, frame, name);
        push(8 * (p.y - y));
        push(8 * (p.z - (z - 0.015)));
      }
      const elbow = (108 * Math.PI) / 180;
      const elev = (68 * Math.PI) / 180;
      push(12 * (angles["elbow_L.flex"] - elbow));
      push(12 * (angles["elbow_R.flex"] - elbow));
      push(12 * (angles["shoulder_L.elev"] - elev));
      push(12 * (angles["shoulder_R.elev"] - elev));
      push(18 * angles["clavicle_L.elev"]);
      push(18 * angles["clavicle_R.elev"]);
      push(10 * (angles["shoulder_L.plane"] - (42 * Math.PI) / 180));
      push(10 * (angles["shoulder_R.plane"] - (42 * Math.PI) / 180));
    },
  ],
  checks: () => [
    checkFlatBack("Maintain a mostly upright torso position with your back flat.", 14),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("arms-up", "Arms stay up in front", "While keeping your arms parallel to the ground, avoid dropping your arms.", "shoulder_L.elev", "peak", 55, 110),
    {
      id: "arms-forward",
      label: "Arms stay out in front of the bar",
      cue: "Avoid dropping your arms, which can cause the bar to roll forward.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => deg(a["elbow_L.flex"]), 125, "° of elbow flexion"),
    },
    checkJointWithinAt(
      "bar-shelf",
      "Elbows stay up so the bar can sit on the delts",
      "Keep the bar resting on your front delts and avoid dropping your arms, which can cause the bar to roll forward.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
  ],
});
