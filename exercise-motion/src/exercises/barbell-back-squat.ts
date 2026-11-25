import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hands outside the shoulders, bar on the meat of the upper back. */
const ARMS = {
  "clavicle.prot": -12,
  "clavicle.elev": 6,
  "shoulder.elev": 38,
  "shoulder.plane": -30,
  "shoulder.twist": -64,
  "elbow.flex": 132,
  "forearm.pron": 56,
  "wrist.flex": -18,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.56,
  "root.z": -0.06,
  "root.pitch": 24,
  "hip.flex": 104,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 112,
  "ankle.dorsi": 22,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "barbell-back-squat",
  catalogId: "1a25c6f170d8803d8231d083fdd65458",
  name: "Barbell Back Squat",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.55 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.62 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack("Let your torso naturally lean forward at your hips, but avoid letting your lower back round or chest cave down.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("hips-and-knees", "Hips and knees bend together", "Progressively bend at your knees and hips to squat down in a controlled manner.", "hip_L.flex", "peak", 85, 125),
    checkJointWithinAt("chest-up", "Chest stays up", "Keep your chest up and back flat as you squat.", "thoracic.flex", "peak", -12, 22),
  ],
});
