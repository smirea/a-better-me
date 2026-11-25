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
  id: "tempo-back-squat",
  catalogId: "1a25c6f170d880ca9d79d2832be4d932",
  name: "Tempo Back Squat",
  defaultLoadKg: 55,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Slow lower", "Pause", "Drive", "Top"],
  tempo: { lower: 3.2, bottom: 1.6, raise: 1.15, top: 0.5 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.62 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack("Lower slowly while keeping the chest up and the back flat.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Slowly squat down until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("pause", "Pause at the bottom of the tempo", "A tempo back squat typically pauses in the bottom before the explosive stand.", "knee_L.flex", "peak", 95, 135),
    checkJointWithinAt("chest-up", "Chest stays up on the slow lower", "Control every moment of the lowering phase with the chest up.", "thoracic.flex", "peak", -12, 22),
  ],
});
