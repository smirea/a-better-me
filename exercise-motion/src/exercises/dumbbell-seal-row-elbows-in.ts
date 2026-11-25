import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Face-down on a high flat bench. Neutral grip, elbows tucked toward the hips. */
const BENCH_TOP = 0.78;

const PRONE = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.82,
  "root.z": -0.2,
  "root.pitch": 84,
  "hip.flex": 4,
  "hip.abd": 10,
  "knee.flex": 6,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -12,
};

const GRIP = {
  "shoulder.twist": 0,
  "forearm.pron": 0,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-seal-row-elbows-in",
  catalogId: "1a15c6f170d880ec8eb2edff1260c7bc",
  name: "Dumbbell Seal Row (Elbows-In)",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Hip", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
  },
  stiffness: { lumbar: 16, thoracic: 14, hip: 8, knee: 6 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 52,
      "shoulder.plane": 64,
      "elbow.flex": 8,
      "clavicle.prot": 4,
      "clavicle.elev": 2,
    },
    end: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 34,
      "shoulder.plane": 56,
      "elbow.flex": 110,
      "clavicle.prot": -14,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest and thighs on the bench. Do not arch your lower back to lift your chest.",
    ),
    checkNeutralNeck("Tuck your chin and lift your head just enough to keep your face off the bench."),
    checkJointRange(
      "seal-pull",
      "Elbows drive back toward the hips",
      "Drive your elbows backward and upward in an arc, tucked by your sides, and pull the dumbbells toward your hips.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Angle your palms in toward each other so the back of each elbow points backward.",
      "forearm_L.pron",
      "start",
      -25,
      25,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbows stay tucked",
      "Keep the elbows by your sides. Finish level with the torso or slightly behind it.",
      "shoulder_L.plane",
      "peak",
      48,
      68,
    ),
  ],
});
