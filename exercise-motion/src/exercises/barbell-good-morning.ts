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
  id: "barbell-good-morning",
  catalogId: "1a35c6f170d880eda0b7e8540f9367a6",
  name: "Barbell Good Morning",
  defaultLoadKg: 40,
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
    rack: { hookY: 1.48, safetyY: 0.9, zCenter: 0.15 },
  },
  apparatus: { kind: "barbell", style: "straight", gripX: 0.42, restAnchor: "traps", anchor: "press" },
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
      "torso-angle",
      "Torso approaches horizontal",
      "While you hinge at your hips, the bar will naturally descend, and your torso will transition to an angle that is closer to horizontal.",
      "hip_L.flex",
      "bottom",
      60,
      110,
    ),
  ],
});
