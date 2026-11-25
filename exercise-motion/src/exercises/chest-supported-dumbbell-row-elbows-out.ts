import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Prone on an elevated flat bench. Hybrid grip, elbows flare about 45°. */
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
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "chest-supported-dumbbell-row-elbows-out",
  catalogId: "2ab5c6f170d880839baed369debc0459",
  name: "Chest-Supported Dumbbell Row (Elbows-Out)",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Flare", "Lower", "Hang"],
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
      "shoulder.plane": 68,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 18,
      "elbow.flex": 102,
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
      "elbows-out-row",
      "Elbows arc back and out",
      "Drive your elbows backward, upward, and about 45 degrees out from your sides. The dumbbells arc; they do not travel straight up.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hybrid",
      "Hybrid overhand grip",
      "Angle your palms diagonally backward and inward, and rotate the whole arm so each elbow points out and back.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "flare",
      "Elbows finish flared",
      "Finish with the elbows level with the torso or slightly behind it, flared about 45 degrees from your sides.",
      "shoulder_L.plane",
      "peak",
      8,
      28,
    ),
  ],
});
