import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Elbows tucked forward, bar on the heels of the hands at the collarbone. */
const RACK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": -8,
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 46,
  "shoulder.plane": 84,
  "shoulder.twist": 8,
  "elbow.flex": 98,
  "forearm.pron": 62,
  "wrist.flex": 0,
};

const LOCKOUT = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "clavicle.elev": 22,
  "clavicle.prot": -4,
  "shoulder.elev": 166,
  "shoulder.plane": 76,
  "shoulder.twist": -8,
  "elbow.flex": 6,
  "forearm.pron": 58,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "close-grip-barbell-overhead-press",
  catalogId: "1a05c6f170d880db967edeae7b23fd4f",
  name: "Close Grip Barbell Overhead Press",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Rack"],
  station: { kind: "standing", stanceX: 0.17, rack: { hookY: 1.38, safetyY: 0.9 } },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.18,
    anchor: "press",
    path: { startY: 1.48, startZ: 0.26, endY: 1.9, endZ: 0.08, arcBulgeZ: 0.02 },
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
    checkFlatBack("Brace and keep the lower back only mildly arched. Do not lean back to drive the bar."),
    checkNeutralNeck("Tuck the chin to clear the bar, then return the head under the bar. Do not crane the neck."),
    checkFeetPlanted("Stand with the feet about shoulder-width and keep them planted. This is not a push press."),
    checkJointRange("elbow-rom", "Elbows extend overhead", "Press until the elbows straighten with the bar stacked over the shoulders.", "elbow_L.flex", 45),
    checkJointWithinAt("lockout-elbow", "Elbows locked out", "Finish with the elbows straight and the bar overhead.", "elbow_L.flex", "peak", -4, 24),
    checkJointWithinAt("lockout-shoulder", "Shoulders flexed at lockout", "Lock the bar out with the shoulders flexed, short of a flipped overhead position.", "shoulder_L.elev", "peak", 80, 174),
    checkJointWithinAt("legs-straight", "Legs stay straight", "Keep the knees straight. Do not dip and drive.", "knee_L.flex", "peak", 0, 12),
  ],
});
