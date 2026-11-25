import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Same hinged straight-arm pulldown, overhand on a straight bar. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 12,
  "hip.flex": 16,
  "knee.flex": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 8,
};

const OVERHEAD = {
  "shoulder.elev": 148,
  "shoulder.plane": 68,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

const THIGHS = {
  ...OVERHEAD,
  "shoulder.elev": 42,
  "shoulder.plane": 60,
  "elbow.flex": 10,
  "clavicle.elev": -8,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "cable-bar-straight-arm-lat-pulldown",
  catalogId: "1a15c6f170d880308073fc37f580cda4",
  name: "Cable Bar Straight Arm Lat Pulldown",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Pull", "Thighs", "Return", "Overhead"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, torsoLeanDeg: 12, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 2.08, 0.72],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.7,
    gripX: 0.22,
  },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 12, thoracic: 10, hip: 8, knee: 6 },
  hints: {
    start: { ...TRUNK, ...OVERHEAD },
    end: { ...TRUNK, ...THIGHS },
  },
  checks: () => [
    checkFlatBack(
      "Sit the hips back into a moderate hinge and keep that incline, with the back flat, for the whole set.",
      18,
    ),
    checkJointWithinAt(
      "overhand",
      "Shoulder-width overhand grip",
      "Grasp the bar so the palms angle forward and downward, elbows and wrists straight.",
      "forearm_L.pron",
      "top",
      48,
      90,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straightened",
      "Keep the elbows straightened while the arms sweep at the shoulders.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "overhead",
      "Arms start fully overhead",
      "Walk back until the stack separates and the arms line up with the high cable.",
      "shoulder_L.elev",
      "top",
      140,
      178,
    ),
    checkJointRange(
      "shoulder-extension",
      "Arms sweep down to the thighs",
      "Drive down, then pull back, until the hands are right by the thighs.",
      "shoulder_L.elev",
      90,
    ),
  ],
});
