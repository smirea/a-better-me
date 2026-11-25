import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/**
 * Strict press with a thick axle: overhand grip, less wrist extension than a
 * standard bar, no knee dip.
 */
const RACK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": -6,
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 50,
  "shoulder.plane": 72,
  "shoulder.twist": 12,
  "elbow.flex": 96,
  "forearm.pron": 48,
  "wrist.flex": 4,
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
  "shoulder.plane": 68,
  "shoulder.twist": -6,
  "elbow.flex": 6,
  "forearm.pron": 44,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "axle-strict-press",
  catalogId: "3a05c6f170d880acb429cc22116f4479",
  name: "Axle Strict Press",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Rack"],
  station: { kind: "standing", stanceX: 0.17, rack: { hookY: 1.38, safetyY: 0.9 } },
  apparatus: {
    kind: "barbell",
    style: "axle",
    gripX: 0.24,
    anchor: "press",
    path: { startY: 1.46, startZ: 0.24, endY: 1.86, endZ: 0.08, arcBulgeZ: 0.02 },
  },
  hints: { start: RACK, end: LOCKOUT },
  stiffness: { elbow: 5, shoulder: 4, lumbar: 10, knee: 8, wrist: 5 },
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
    checkFlatBack("Brace and keep the torso stacked. A strict press does not turn into a layback."),
    checkNeutralNeck("Move the chin back only enough for the axle to pass the face."),
    checkFeetPlanted("Keep the feet planted and the knees straight. Do not push-press the axle."),
    checkJointRange("elbow-rom", "Elbows extend overhead", "Press the axle from the collarbone until the elbows straighten.", "elbow_L.flex", 25),
    checkJointWithinAt("lockout-elbow", "Elbows locked out", "Finish with straight elbows and the axle over the midfoot.", "elbow_L.flex", "peak", -4, 24),
    checkJointWithinAt("lockout-shoulder", "Shoulders flexed at lockout", "Lock out with the shoulders flexed, short of a flipped overhead position.", "shoulder_L.elev", "peak", 85, 174),
    checkJointWithinAt("legs-straight", "No leg drive", "The knees stay nearly straight through the press.", "knee_L.flex", "peak", 0, 12),
  ],
});
