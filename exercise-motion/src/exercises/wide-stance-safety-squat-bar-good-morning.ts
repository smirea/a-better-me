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
  id: "wide-stance-safety-squat-bar-good-morning",
  catalogId: "2995c6f170d880f995aed50527985177",
  name: "Wide Stance Safety Squat Bar Good Morning",
  defaultLoadKg: 32,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Upright"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.6, top: 0.6 },
  station: {
    kind: "standing",
    stanceX: 0.28,
    toeOutDeg: 22,
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
    start: { ...POSTURE_HINTS.standing, ...ARMS, "hip.abd": 16, "hip.rot": 8, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.1,
      "root.pitch": 56,
      "hip.flex": 74,
      "hip.abd": 16,
      "hip.rot": 8,
      "knee.flex": 22,
      "ankle.dorsi": 6,
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
      40,
    ),
    checkJointWithinAt(
      "wide-stance",
      "Hips stay open",
      "Position your feet clearly outside shoulder width with your toes moderately to mildly pointing outward.",
      "hip_L.abd",
      "bottom",
      10,
      36,
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
