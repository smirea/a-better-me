import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

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
  id: "pause-back-squat",
  catalogId: "1a25c6f170d880db8636d9788926a62d",
  name: "Pause Back Squat",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Pause", "Stand", "Top"],
  tempo: { lower: 2, bottom: 2, raise: 1.5, top: 0.55 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.62 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack("Let your torso naturally lean forward at your hips, but avoid letting your lower back round.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("pause", "Paused in the hole", "Once you reach the bottom, pause and stay completely stationary for about two seconds.", "knee_L.flex", "peak", 95, 135),
    checkJointWithinAt("chest-up", "Stay tight through the pause", "Keep your chest up and back flat while you remain stationary.", "thoracic.flex", "peak", -12, 22),
  ],
});
