import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Palms face each other on the cambered handles in front of the shoulders. */
const ARMS = {
  "clavicle.prot": 8,
  "shoulder.elev": 48,
  "shoulder.plane": 50,
  "shoulder.twist": 24,
  "elbow.flex": 98,
  "forearm.pron": -16,
  "wrist.flex": 12,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.55,
  "root.z": -0.02,
  "root.pitch": 18,
  "hip.flex": 106,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 116,
  "ankle.dorsi": 24,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "safety-squat-bar-squat",
  catalogId: "2135c6f170d88076befdd9d49319cf5d",
  name: "Safety Squat Bar Squat",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 1.9, bottom: 0.3, raise: 1.45, top: 0.55 },
  station: {
    kind: "standing",
    stanceX: 0.19,
    toeOutDeg: 18,
    trackKnees: 12,
    rack: { hookY: 1.32, safetyY: 0.64 },
  },
  apparatus: {
    kind: "barbell",
    style: "ssb",
    restAnchor: "traps",
    gripX: 0.16,
    skipHandRequired: true,
    anchor: "press",
  },
  extraContacts: {
    bar: { neck: 0.03, girdle: 0.05, chest: 0.03, upperarm_L: 0.05, upperarm_R: 0.05 },
  },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 4, shoulder: 2.2, lumbar: 6 },
  checks: () => [
    checkFlatBack("Let your torso lean forward at the hips, but keep the back flat.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Full squat depth", "Descend at least until the thighs are fairly close to being parallel to the ground.", "knee_L.flex", 70),
    checkJointWithinAt("handles", "Hands stay on the SSB handles", "Grasp the handles with the palms facing each other and the elbows bent.", "elbow_L.flex", "peak", 70, 130),
    checkJointWithinAt("pad-on-back", "Pad stays on the upper back", "Keep the bar on the muscles of the upper back, not on the neck.", "shoulder_L.elev", "bottom", 30, 80),
  ],
});
