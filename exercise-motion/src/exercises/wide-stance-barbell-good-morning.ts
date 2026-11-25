import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hands outside the shoulders, pulling the bar down into the upper back. */
const ARMS = {
  "clavicle.prot": -12,
  "shoulder.elev": 42,
  "shoulder.plane": -38,
  "shoulder.twist": -62,
  "elbow.flex": 118,
  "forearm.pron": 58,
  "wrist.flex": -22,
};

export const spec = buildExerciseSpec({
  id: "wide-stance-barbell-good-morning",
  catalogId: "1f25c6f170d880a0ba4fdffba6fa4a97",
  name: "Wide Stance Barbell Good Morning",
  defaultLoadKg: 36,
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
  apparatus: { kind: "barbell", style: "straight", gripX: 0.42, restAnchor: "traps", anchor: "press" },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "hip.flex": 6,
      "hip.abd": 14,
      "hip.rot": 6,
      "knee.flex": 8,
      "root.pitch": 4,
      "root.z": 0.02,
    },
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
      "Position your feet into a clearly outside shoulder-width stance with your toes pointing outward.",
      "hip_L.abd",
      "bottom",
      10,
      36,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "You should not keep your knees fully straightened. The mild knee bend occurs when you sit your buttocks backward.",
      "knee_L.flex",
      "bottom",
      8,
      36,
    ),
  ],
});
