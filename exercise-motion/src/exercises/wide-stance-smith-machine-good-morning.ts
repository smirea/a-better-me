import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

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
  id: "wide-stance-smith-machine-good-morning",
  catalogId: "2995c6f170d88013930fe5be0247f177",
  name: "Wide Stance Smith Machine Good Morning",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Upright"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.6, top: 0.55 },
  station: {
    kind: "standing",
    stanceX: 0.3,
    toeOutDeg: 22,
    smith: { stopY: 0.82 },
  },
  apparatus: { kind: "barbell", style: "straight", gripX: 0.46, restAnchor: "traps", anchor: "press" },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "hip.abd": 16,
      "hip.rot": 10,
      "root.z": 0.02,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.84,
      "root.z": -0.08,
      "root.pitch": 70,
      "hip.flex": 96,
      "hip.abd": 18,
      "hip.rot": 8,
      "knee.flex": 20,
      "ankle.dorsi": 6,
      "neck.flex": -4,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back mildly arched or flat while your feet stay clearly outside shoulder width.",
      16,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are standing and looking straight ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Hinge through the hips in a wide stance",
      "Sit your hips back with the toes turned out. Most of the motion still comes from the hips.",
      "hip_L.flex",
      42,
    ),
    checkJointWithinAt(
      "wide-hips",
      "Stance stays wide",
      "Keep the feet clearly outside shoulder width, with the toes turned moderately outward.",
      "hip_L.abd",
      "start",
      8,
      36,
    ),
    checkJointWithinAt(
      "soft-knees",
      "Knees stay softly bent",
      "Shins stay close to vertical. Do not lock the knees or squat the bar down.",
      "knee_L.flex",
      "bottom",
      8,
      36,
    ),
  ],
});
