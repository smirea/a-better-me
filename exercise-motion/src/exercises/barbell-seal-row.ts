import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Prone on a high flat bench; the bar hangs under the chest and finishes against the pad. */
const BENCH_TOP = 0.78;

const GRIP = {
  "shoulder.twist": 14,
  "forearm.pron": 75,
  "wrist.flex": 8,
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
  id: "barbell-seal-row",
  catalogId: "2e35c6f170d880c0b0cde92fcc3eee3d",
  name: "Barbell Seal Row",
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
    gripX: 0.3,
    path: { startY: 0.36, startZ: 0.08, endY: 0.64, endZ: 0.04 },
  },
  hints: {
    start: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 72,
      "shoulder.plane": 80,
      "elbow.flex": 10,
      "clavicle.prot": 2,
      "clavicle.elev": 2,
    },
    end: {
      ...PRONE,
      ...GRIP,
      "shoulder.elev": 70,
      "shoulder.plane": 40,
      "elbow.flex": 115,
      "clavicle.prot": -12,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest and the rest of your torso in contact with the bench instead of arching your lower back to lift the chest.",
    ),
    checkNeutralNeck(
      "Tuck your chin and lift your head just enough to keep your face off the bench.",
    ),
    checkJointRange(
      "seal-pull",
      "Bar rises to the bench",
      "Pull the bar up toward your upper abdomen and lower chest until it meets the underside of the bench.",
      "elbow_L.flex",
      50,
    ),
    checkJointWithinAt(
      "long-hang",
      "Arms hang straight under the bench",
      "Start with your arms hanging and your elbows straight or only slightly bent, shoulder blades pulled apart by the bar.",
      "elbow_L.flex",
      "start",
      0,
      36,
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
      "Squeeze your shoulder blades together at the top of the pull, with the elbows finishing near shoulder height.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
  ],
});
