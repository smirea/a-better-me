import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Prone on a high bench. The camber lets the hands finish higher than a straight bar would. */
const BENCH_TOP = 0.82;

const GRIP = {
  "shoulder.twist": 14,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

const PRONE = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.86,
  "root.z": -0.18,
  "root.pitch": 84,
  "hip.flex": 4,
  "hip.abd": 10,
  "knee.flex": 6,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -12,
};

export const spec = buildExerciseSpec({
  id: "cambered-bar-seal-row",
  catalogId: "3565c6f170d880f09ea0dc8605d13ebe",
  name: "Cambered Bar Seal Row",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Above pad", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
  },
  stiffness: { lumbar: 16, thoracic: 14, hip: 8, knee: 6 },
  apparatus: {
    kind: "barbell",
    style: "cambered",
    gripX: 0.3,
    path: { startY: 0.34, startZ: 0.06, endY: 0.78, endZ: 0.02 },
  },
  hints: {
    start: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 74,
      "shoulder.plane": 80,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 2,
    },
    end: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 78,
      "shoulder.plane": 36,
      "elbow.flex": 118,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest and the rest of your torso in contact with the bench instead of arching your lower back to lift the chest.",
    ),
    checkNeutralNeck("Tuck your chin and lift your head just enough to keep your face off the bench."),
    checkJointRange(
      "camber-pull",
      "Bar rises past the bench line",
      "Pull the bar up toward your upper abdomen and lower chest. The camber lets your elbows finish slightly above shoulder height.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "long-hang",
      "Arms hang under the bench",
      "Start with your arms hanging and your elbows straight, shoulder blades pulled apart by the bar.",
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
      "elbows-high",
      "Elbows finish near shoulder height",
      "Row through a full range so the elbows finish slightly above shoulder height, since the camber clears the bench.",
      "elbow_L.flex",
      "peak",
      90,
      145,
    ),
  ],
});
