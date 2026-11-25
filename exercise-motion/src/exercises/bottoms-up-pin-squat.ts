import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "clavicle.prot": -14,
  "clavicle.elev": 6,
  "shoulder.elev": 36,
  "shoulder.plane": -32,
  "shoulder.twist": -68,
  "elbow.flex": 136,
  "forearm.pron": 58,
  "wrist.flex": -22,
};

/** Start is the dead-stop bottom on the safety pins; the first phase stands up. */
const BOTTOM = {
  "root.y": 0.56,
  "root.z": -0.06,
  "root.pitch": 24,
  "hip.flex": 104,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 108,
  "ankle.dorsi": 22,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
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

export const spec = buildExerciseSpec({
  id: "bottoms-up-pin-squat",
  catalogId: "1a25c6f170d88002af2fe9c5835b7524",
  name: "Bottoms Up Pin Squat",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Stand", "Top", "Lower", "Rest"],
  tempo: { lower: 1.6, bottom: 0.4, raise: 2, top: 1.2 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 1.02 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  hints: { start: BOTTOM, end: STAND },
  checks: () => [
    checkFlatBack("Drive through the ground to stand upright with the bar while keeping your chest up and back flat.", 16),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkFeetPlanted("Continue keeping the entire sole of each foot firmly planted on the ground throughout the set."),
    checkJointRange("stand-up", "Stand from the pins", "Drive through the ground to stand upright with the bar by extending your knees and hips.", "knee_L.flex", 80),
    checkJointWithinAt("dead-stop", "Starts from the bottom", "Set up under the bar with your back flat, heels fully on the ground, and squat up from a dead stop.", "knee_L.flex", "start", 90, 130),
    checkJointWithinAt("lockout", "Fully upright at the top", "Stand upright with the bar by extending your knees and hips.", "knee_L.flex", "peak", 0, 12),
  ],
});
