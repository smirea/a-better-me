import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Prone on an elevated flat bench. Neutral grip, elbows stay tucked by the ribs. */
const BENCH_TOP = 0.78;

const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.84,
  "root.z": -0.18,
  "root.pitch": 82,
  "hip.flex": 6,
  "hip.abd": 10,
  "knee.flex": 8,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -10,
};

const GRIP = {
  "shoulder.twist": 0,
  "forearm.pron": 0,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "chest-supported-dumbbell-row-elbows-in",
  catalogId: "1a15c6f170d8802d969ae139f42062fa",
  name: "Chest-Supported Dumbbell Row (Elbows-In)",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Hip", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, knee: 4 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 52,
      "shoulder.plane": 64,
      "elbow.flex": 8,
      "clavicle.prot": 4,
      "clavicle.elev": 4,
    },
    end: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 32,
      "shoulder.plane": 56,
      "elbow.flex": 108,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest on the bench. Do not arch your lower back to lift your chest off the pad.",
    ),
    checkNeutralNeck("Tuck your chin enough that your face stays clear of the bench."),
    checkJointRange(
      "elbows-in-row",
      "Elbows drive back toward the hips",
      "Drive your elbows backward and upward in an arc, tucked by your sides, and pull the dumbbells toward your hips.",
      "elbow_L.flex",
      65,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral grip",
      "Angle your palms in toward each other and keep that neutral grip for the whole set.",
      "forearm_L.pron",
      "start",
      -25,
      25,
    ),
    checkJointWithinAt(
      "tucked",
      "Elbows stay tucked",
      "Keep the elbows by your ribs rather than flaring them. Finish level with the torso or slightly behind it.",
      "shoulder_L.plane",
      "peak",
      48,
      68,
    ),
  ],
});
