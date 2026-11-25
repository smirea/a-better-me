import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Face-down on a high flat bench. Hybrid grip, elbows flare about 45°. */
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
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-seal-row-elbows-out",
  catalogId: "1d45c6f170d880c89281e6901f4c3849",
  name: "Dumbbell Seal Row (Elbows-Out)",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Flare", "Lower", "Hang"],
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
      "shoulder.plane": 68,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 2,
    },
    end: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 18,
      "elbow.flex": 102,
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
      "seal-flare",
      "Elbows arc back and out",
      "Drive your elbows backward, upward, and about 45 degrees out from your sides.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hybrid",
      "Hybrid overhand grip",
      "Angle your palms diagonally backward and inward so each elbow points out and back.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "flare",
      "Elbows finish flared",
      "Finish with the elbows level with the torso or slightly behind it, flared about 45 degrees.",
      "shoulder_L.plane",
      "peak",
      8,
      28,
    ),
  ],
});
