import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Prone on a high flat bench; underhand grip, bar hangs under the shoulders and rows to the pad. */
const BENCH_TOP = 0.78;

const GRIP = {
  "shoulder.twist": -18,
  "forearm.pron": -50,
  "wrist.flex": 6,
};

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

export const spec = buildExerciseSpec({
  id: "underhand-grip-barbell-seal-row",
  catalogId: "2e35c6f170d880ab8134d260a3fb6cf4",
  name: "Underhand Grip Barbell Seal Row",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Bench", "Lower", "Hang"],
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
    style: "straight",
    gripX: 0.2,
    path: { startY: 0.36, startZ: 0.08, endY: 0.64, endZ: 0.04 },
  },
  hints: {
    start: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 70,
      "shoulder.plane": 78,
      "elbow.flex": 10,
      "clavicle.prot": 2,
      "clavicle.elev": 2,
    },
    end: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 62,
      "shoulder.plane": 58,
      "elbow.flex": 115,
      "clavicle.prot": -14,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep the chest and the rest of the torso in contact with the bench instead of arching the lower back to lift the chest.",
    ),
    checkNeutralNeck(
      "Tuck the chin and lift the head just enough to keep the face off the bench.",
    ),
    checkJointWithinAt(
      "underhand",
      "Near shoulder-width underhand grip",
      "Grasp the bar with a near shoulder-width underhand grip so the palms face forward.",
      "forearm_L.pron",
      "start",
      -80,
      -20,
    ),
    checkJointWithinAt(
      "long-hang",
      "Arms hang straight under the bench",
      "Start with the arms hanging and the elbows straight or only slightly bent, shoulder blades pulled apart by the bar.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbows-tucked",
      "Elbows stay near the sides",
      "Drive the elbows back and up close to the sides rather than flaring them, and squeeze the shoulder blades together at the top.",
      "shoulder_L.plane",
      "peak",
      35,
      80,
    ),
    checkJointRange(
      "seal-pull",
      "Bar rises toward the bench",
      "Pull the bar up toward the abdomen until the elbows finish near shoulder height, or until the bench stops the bar.",
      "elbow_L.flex",
      50,
    ),
  ],
});
