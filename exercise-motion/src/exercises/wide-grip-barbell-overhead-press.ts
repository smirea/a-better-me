import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Elbows flared out more than a close-grip press. Bar on the collarbone. */
const RACK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": -8,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
  "shoulder.elev": 58,
  "shoulder.plane": 40,
  "shoulder.twist": 16,
  "elbow.flex": 92,
  "forearm.pron": 55,
  "wrist.flex": -6,
};

const LOCKOUT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "clavicle.elev": 24,
  "clavicle.prot": -4,
  "shoulder.elev": 168,
  "shoulder.plane": 36,
  "shoulder.twist": -6,
  "elbow.flex": 6,
  "forearm.pron": 52,
  "wrist.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-barbell-overhead-press",
  catalogId: "1a05c6f170d8806c83bac84cb4b90d45",
  name: "Wide Grip Barbell Overhead Press",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Rack"],
  station: { kind: "standing", stanceX: 0.17, rack: { hookY: 1.38, safetyY: 0.9 } },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.46, startZ: 0.24, endY: 1.82, endZ: 0.08, arcBulgeZ: 0.02 },
  },
  hints: { start: RACK, end: LOCKOUT },
  stiffness: { elbow: 5, shoulder: 4, lumbar: 10, knee: 8, wrist: 4 },
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 6, 24),
    lockAngle(body, "hip_R.flex", 6, 24),
    lockAngle(body, "lumbar.flex", -6, 22),
    lockAngle(body, "thoracic.flex", -4, 16),
    lockAngle(body, "knee_L.flex", 6, 18),
    lockAngle(body, "knee_R.flex", 6, 18),
    pin(body, "pelvisBottom", () => new Vector3(0, 0.85, 0.04), 55, "yz"),
  ],
  checks: () => [
    checkFlatBack("Keep a proud chest and a mild lower-back arch. Do not lean back further as you press."),
    checkNeutralNeck("Tuck the chin to let the bar pass the face, then bring the ears back under the bar."),
    checkFeetPlanted("Set the feet about shoulder-width and keep the legs straight."),
    checkJointRange("elbow-rom", "Elbows extend overhead", "Press in a near-vertical path until the elbows straighten.", "elbow_L.flex", 25),
    checkJointWithinAt("wide-bottom", "Elbows flared at the rack", "At the collarbone the elbows point out more than they do in a close-grip press.", "shoulder_L.plane", "start", -15, 75),
    checkJointWithinAt("lockout-elbow", "Elbows locked out", "Finish with straight elbows and the bar over the midfoot.", "elbow_L.flex", "peak", -4, 40),
    checkJointWithinAt("lockout-shoulder", "Shoulders up at lockout", "Lock out with the shoulders flexed, short of a flipped overhead position.", "shoulder_L.elev", "peak", 85, 174),
  ],
});
