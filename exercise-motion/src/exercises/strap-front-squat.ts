import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Straps hang from the bar just outside the shoulders. Palms face each other
 * and the hands sit slightly above the shaft, so the wrists stay neutral.
 */
const ARMS = {
  "clavicle.elev": 4,
  "clavicle.prot": -2,
  "shoulder.elev": 78,
  "shoulder.plane": 42,
  "shoulder.twist": 6,
  "elbow.flex": 96,
  "forearm.pron": -8,
  "wrist.flex": 4,
  "wrist.dev": 0,
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
  id: "strap-front-squat",
  catalogId: "2165c6f170d88086b1b2c72025f4a497",
  name: "Strap Front Squat",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.24,
    anchor: "grip",
    restAnchor: "frontRack",
    skipHandRequired: true,
    alignWrists: false,
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 5, shoulder: 2.8, wrist: 2.4, forearm: 2 },
  extraContacts: { bar: { girdle: 0.03, neck: 0.02, chest: 0.03 } },
  extraGoals: (body) => [
    ({ frame, angles, push }) => {
      for (const side of ["L", "R"] as const) {
        const rack = anchorPoint(body, frame, `frontRack_${side}`);
        const hand = anchorPoint(body, frame, `grip_${side}`);
        const sign = side === "L" ? 1 : -1;
        push(12 * (hand.x - (rack.x + sign * 0.06)));
        push(16 * (hand.y - (rack.y + 0.11)));
        push(10 * (hand.z - (rack.z + 0.02)));
      }
      const elev = (78 * Math.PI) / 180;
      const elbow = (96 * Math.PI) / 180;
      push(12 * (angles["shoulder_L.elev"] - elev));
      push(12 * (angles["shoulder_R.elev"] - elev));
      push(12 * (angles["elbow_L.flex"] - elbow));
      push(12 * (angles["elbow_R.flex"] - elbow));
      push(8 * (angles["forearm_L.pron"] - (-8 * Math.PI) / 180));
      push(8 * (angles["forearm_R.pron"] - (-8 * Math.PI) / 180));
    },
  ],
  checks: () => [
    checkFlatBack("Maintain a mostly upright torso position with your back flat."),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("elbows-up", "Elbows stay high on the straps", "While holding the straps, lift your elbows until your upper arms are parallel to the ground.", "shoulder_L.elev", "peak", 60, 120),
    checkJointWithinAt("hands-above", "Hands stay above the bar", "Hold the straps with bent elbows so your hands are slightly above the bar.", "elbow_L.flex", "peak", 70, 120),
  ],
});
