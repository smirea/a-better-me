import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { Vector3 } from "three";
import { lockAngle, pin } from "../solver";

/**
 * Strict log press: thick cylinder (axle prop) held in a neutral grip at the
 * front of the shoulders, pressed overhead without a leg dip.
 */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": -4,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
};

const RACK = {
  "clavicle.elev": 8,
  "clavicle.prot": -6,
  "shoulder.elev": 50,
  "shoulder.plane": 72,
  "shoulder.twist": 10,
  "elbow.flex": 96,
  "forearm.pron": 44,
  "wrist.flex": 4,
};

const LOCKOUT = {
  "clavicle.elev": 20,
  "clavicle.prot": -4,
  "shoulder.elev": 166,
  "shoulder.plane": 68,
  "shoulder.twist": -6,
  "elbow.flex": 6,
  "forearm.pron": 44,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "strict-log-press",
  catalogId: "2ff5c6f170d880e39d3ffa1a195939df",
  name: "Strict Log Press",
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
  hints: { start: { ...TRUNK, ...RACK }, end: { ...TRUNK, ...LOCKOUT, "root.pitch": 2, "neck.flex": 0 } },
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
    checkFlatBack("Brace and keep the torso stacked. A strict log press does not turn into a layback.", 16),
    checkNeutralNeck("Look forward and move the chin only enough for the log to pass the face."),
    checkFeetPlanted("Keep the feet planted and the knees straight. Do not push-press the log."),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip on the log",
      "The log is a thick cylinder. The hands sit closer than a barbell press and the palms stay less turned-over than a standard overhand grip.",
      "forearm_L.pron",
      "start",
      20,
      90,
    ),
    checkJointRange(
      "elbow-rom",
      "Press the log overhead",
      "Press the log from the front of the shoulders until the elbows straighten overhead.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows locked out",
      "Finish with straight elbows and the log over the shoulders.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "legs-straight",
      "No leg drive",
      "The knees stay nearly straight through the press.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
  ],
});
