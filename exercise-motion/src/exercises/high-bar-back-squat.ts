import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** High bar sits on the traps. Elbows tuck under a closer grip and the torso stays tall. */
const ARMS = {
  "clavicle.prot": -8,
  "clavicle.elev": 8,
  "shoulder.elev": 46,
  "shoulder.plane": -16,
  "shoulder.twist": -52,
  "elbow.flex": 124,
  "forearm.pron": 48,
  "wrist.flex": -12,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.abd": 8,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.54,
  "root.z": -0.02,
  "root.pitch": 14,
  "hip.flex": 108,
  "hip.abd": 16,
  "hip.rot": 10,
  "knee.flex": 122,
  "ankle.dorsi": 28,
  "ankle.inv": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "high-bar-back-squat",
  catalogId: "2115c6f170d880dfb3e2ff8447c9a0b5",
  name: "High Bar Back Squat",
  defaultLoadKg: 65,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.55 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 14, trackKnees: 14, rack: { hookY: 1.42, safetyY: 0.62 } },
  apparatus: { kind: "barbell", gripX: 0.32, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { lumbar: 6, thoracic: 6, shoulder: 1.2 },
  checks: () => [
    checkFlatBack("Keep your chest up and back flat, with only a mild forward lean at the hips.", 12),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full high-bar depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 75),
    checkJointWithinAt("upright", "Torso stays upright", "Sit the hips back only slightly and keep a mostly upright torso, the way a high-bar squat does.", "thoracic.flex", "peak", -8, 16),
    checkJointWithinAt("elbows-under", "Elbows tuck under the high bar", "Pull down on the bar so it stays on the traps just below the base of the neck.", "shoulder_L.plane", "peak", -70, -20),
  ],
});
