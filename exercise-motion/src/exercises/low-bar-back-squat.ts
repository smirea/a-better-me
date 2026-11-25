import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low bar rests on the rear delts, below the scapular spine. Wider grip, more hip hinge. */
const ARMS = {
  "clavicle.prot": -18,
  "clavicle.elev": 4,
  "shoulder.elev": 28,
  "shoulder.plane": -46,
  "shoulder.twist": -78,
  "elbow.flex": 142,
  "forearm.pron": 64,
  "wrist.flex": -26,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 8,
  "hip.abd": 12,
  "hip.rot": 16,
  "knee.flex": 8,
  "ankle.dorsi": 4,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.62,
  "root.z": -0.14,
  "root.pitch": 38,
  "hip.flex": 112,
  "hip.abd": 22,
  "hip.rot": 6,
  "knee.flex": 100,
  "ankle.dorsi": 16,
  "ankle.inv": 2,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": 4,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "low-bar-back-squat",
  catalogId: "1a25c6f170d8805a8982ddf0cc544287",
  name: "Low Bar Back Squat",
  defaultLoadKg: 80,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 1.9, bottom: 0.25, raise: 1.45, top: 0.55 },
  station: { kind: "standing", stanceX: 0.24, toeOutDeg: 28, trackKnees: 10, rack: { hookY: 1.28, safetyY: 0.7 } },
  apparatus: {
    kind: "barbell",
    gripX: 0.48,
    anchor: "press",
    restAnchor: "upperBack",
    // The rear-delt shelf sits behind the hands, so the shaft contact check cannot pass.
    skipHandRequired: true,
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { lumbar: 6, thoracic: 5.5, shoulder: 1.4, wrist: 2.6 },
  extraContacts: { bar: { girdle: 0.04, upperarm_L: 0.05, upperarm_R: 0.05 } },
  checks: () => [
    checkFlatBack("Let your torso lean forward at the hips, but keep the lower back from rounding.", 18),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Squat to depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 65),
    checkJointWithinAt("hip-hinge", "More hip hinge than a high-bar squat", "Sit the hips back so the torso leans forward while the bar stays on the rear delts.", "hip_L.flex", "peak", 100, 135),
    checkJointWithinAt("wide-grip", "Elbows stay back under the low bar", "Pull down on the bar so it stays on the back of the shoulders, below the scapular spine.", "elbow_L.flex", "peak", 110, 160),
  ],
});
