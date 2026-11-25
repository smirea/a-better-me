import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Palms face each other on the SSB's forward handles. */
/** Handles sit forward of the yoke, so the elbows point down and the hands meet them. */
const ARMS = {
  "clavicle.prot": 8,
  "shoulder.elev": 46,
  "shoulder.plane": 48,
  "shoulder.twist": 24,
  "elbow.flex": 96,
  "forearm.pron": -16,
  "wrist.flex": 12,
};

export const spec = buildExerciseSpec({
  id: "safety-squat-bar-good-morning",
  catalogId: "1f35c6f170d880d59516f3a78b19b71d",
  name: "Safety Squat Bar Good Morning",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Upright"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.6, top: 0.6 },
  station: {
    kind: "standing",
    stanceX: 0.18,
    toeOutDeg: 12,
    balanceZ: 0.02,
    rack: { hookY: 1.48, safetyY: 0.88, zCenter: 0.12 },
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
    bar: { neck: 0.03, girdle: 0.055, chest: 0.03, upperarm_L: 0.05, upperarm_R: 0.05 },
  },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "hip.abd": 8, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.12,
      "root.pitch": 58,
      "hip.flex": 78,
      "hip.abd": 6,
      "knee.flex": 20,
      "ankle.dorsi": 4,
      "neck.flex": -4,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back near a neutral position, like you have when you are normally standing upright, rather than rounding your lower back.",
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like you have when you are normally standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Hinge through the hips",
      "Most of the motion should come from your hips, and your shins should remain in a vertical position throughout your set.",
      "hip_L.flex",
      42,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "You should not keep your knees fully straightened. The appropriately mild degree of knee bend can naturally occur when you sit your buttocks backward.",
      "knee_L.flex",
      "bottom",
      8,
      35,
    ),
    checkJointWithinAt(
      "handle-grip",
      "Hands stay on the SSB handles",
      "Your palms should be facing in toward each other while grasping the handles with bent elbows.",
      "elbow_L.flex",
      "bottom",
      70,
      140,
    ),
  ],
});
