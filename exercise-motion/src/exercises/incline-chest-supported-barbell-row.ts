import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Chest-supported prone row. A face-down adjustable bench does not seat the torso
 * on the pad in this solver, so this uses the same elevated flat bench as the seal row,
 * with the bar reaching up toward the lower chest.
 */
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
  "shoulder.twist": 14,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "incline-chest-supported-barbell-row",
  catalogId: "3985c6f170d88046ba99e34c83a17099",
  name: "Incline Chest-Supported Barbell Row",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Lower chest", "Lower", "Reach"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, knee: 4 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.36, startZ: 0.04, endY: 0.62, endZ: 0.0 },
  },
  hints: {
    start: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 70,
      "shoulder.plane": 78,
      "elbow.flex": 10,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 58,
      "shoulder.plane": 40,
      "elbow.flex": 112,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest and the rest of your torso in contact with the bench instead of arching your lower back to lift the chest.",
    ),
    checkNeutralNeck("Tuck your chin enough to keep your face clear of the pad."),
    checkJointRange(
      "incline-row",
      "Bar rises toward the lower chest",
      "Pull the bar up toward your upper abdomen and lower chest by driving your elbows backward and upward.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "reach",
      "Arms reach the bar with straight elbows",
      "Set the incline so you can just reach the bar with straight elbows and the shoulders pulled forward.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with a slightly outside shoulder-width overhand grip so your palms face backward.",
      "forearm_L.pron",
      "start",
      50,
      85,
    ),
    checkJointWithinAt(
      "squeeze",
      "Shoulder blades pinch at the top",
      "Squeeze your shoulder blades together. Elbows finish near shoulder height, or as high as the bench allows.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
  ],
});
