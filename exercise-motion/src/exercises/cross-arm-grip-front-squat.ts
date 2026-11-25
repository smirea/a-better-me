import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Forearms cross over the bar, palms down, upper arms parallel to the floor. */
const ARMS = {
  "clavicle.elev": 2,
  "clavicle.prot": -2,
  "shoulder.elev": 70,
  "shoulder.plane": 50,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 72,
  "wrist.flex": 8,
  "wrist.dev": -6,
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
  id: "cross-arm-grip-front-squat",
  catalogId: "1a25c6f170d88038b559cf1d5dbd8366",
  name: "Cross-Arm Grip Front Squat",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.09,
    anchor: "press",
    alignWrists: false,
    path: { startY: 1.5, startZ: 0.2, endY: 1.02, endZ: 0.22 },
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 4, shoulder: 2.4, wrist: 2.5 },
  extraContacts: { bar: { girdle: 0.03, chest: 0.035, upperarm_L: 0.04, upperarm_R: 0.04 } },
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
      const elbow = (105 * Math.PI) / 180;
      push(12 * (angles["shoulder_L.elev"] - elev));
      push(12 * (angles["shoulder_R.elev"] - elev));
      push(12 * (angles["elbow_L.flex"] - elbow));
      push(12 * (angles["elbow_R.flex"] - elbow));
    },
  ],
  checks: () => [
    checkFlatBack("Maintain a mostly upright torso position with your back flat."),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("arms-crossed", "Hands crossed on the bar", "Bend your elbows to cross your forearms as your hands are on top of the bar with your palms facing down.", "elbow_L.flex", "start", 80, 145),
    checkJointWithinAt("elbows-forward", "Upper arms stay parallel", "Keep your upper arms parallel to the ground.", "shoulder_L.elev", "peak", 55, 120),
  ],
});
