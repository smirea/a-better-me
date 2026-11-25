import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Prone on an elevated flat bench. Overhand grip, elbows flare out toward a T at shoulder height. */
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
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "chest-supported-dumbbell-high-row",
  catalogId: "1d35c6f170d88050aeecc0d8b5dfe696",
  name: "Chest-Supported Dumbbell High Row",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "T", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, knee: 4, shoulder: 0.7 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 58,
      "shoulder.plane": 78,
      "elbow.flex": 8,
      "clavicle.prot": 4,
      "clavicle.elev": 4,
    },
    end: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 80,
      "shoulder.plane": 14,
      "elbow.flex": 92,
      "clavicle.prot": -12,
      "clavicle.elev": 14,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your torso on the chest pad. Do not arch your lower back to lift your chest.",
    ),
    checkNeutralNeck("Keep your palms facing backward and your face clear of the pad."),
    checkJointRange(
      "high-row",
      "Elbows flare out to shoulder height",
      "Drive your elbows straight out to the sides and up until your upper arms and torso form a T.",
      "elbow_L.flex",
      50,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Direct your palms backward so the bony bump on the back of each elbow points out to the side.",
      "forearm_L.pron",
      "start",
      50,
      90,
    ),
    checkJointWithinAt(
      "t-shape",
      "Upper arms finish near shoulder height",
      "Pull until the elbows are about level with your shoulders. Do not tuck them back toward your sides.",
      "shoulder_L.elev",
      "peak",
      68,
      98,
    ),
  ],
});
