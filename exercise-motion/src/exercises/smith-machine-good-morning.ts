import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hands outside the shoulders, pulling the Smith bar down into the upper back. */
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
  id: "smith-machine-good-morning",
  catalogId: "1a35c6f170d8808fa1c6e81741d5a44b",
  name: "Smith Machine Good Morning",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Upright"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.6, top: 0.55 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    toeOutDeg: 10,
    balanceZ: 0.02,
    smith: { stopY: 0.85 },
  },
  apparatus: { kind: "barbell", style: "straight", gripX: 0.42, restAnchor: "traps", anchor: "press" },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "hip.abd": 8, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.z": -0.1,
      "root.pitch": 72,
      "hip.flex": 98,
      "hip.abd": 6,
      "knee.flex": 18,
      "ankle.dorsi": 4,
      "neck.flex": -4,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back mildly arched or flat. Do not round it as the Smith bar descends on your upper back.",
      16,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are standing and looking straight ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Hinge through the hips",
      "Most of the motion should come from your hips, and your shins should stay vertical.",
      "hip_L.flex",
      40,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "Do not lock your knees. A mild bend happens when you sit your hips back.",
      "knee_L.flex",
      "bottom",
      8,
      34,
    ),
    checkJointWithinAt(
      "torso-angle",
      "Torso approaches horizontal",
      "Hinge until your torso is closer to horizontal, stopping at the hamstrings' end range.",
      "hip_L.flex",
      "bottom",
      58,
      110,
    ),
  ],
});
