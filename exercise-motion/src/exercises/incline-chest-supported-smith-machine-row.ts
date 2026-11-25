import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Prone chest-supported row inside the Smith: the bar tracks straight up toward the lower chest.
 * Face-down on an adjustable bench does not seat the torso in this solver, so the chest rests
 * on an elevated flat bench between the rails. Overhand grip, elbows flare, scapulae retract.
 */
const BENCH_TOP = 0.78;

const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.84,
  "root.z": -0.16,
  "root.pitch": 78,
  "hip.flex": 8,
  "hip.abd": 10,
  "knee.flex": 10,
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
  id: "incline-chest-supported-smith-machine-row",
  catalogId: "3985c6f170d880e98d27f03cd0c100ac",
  name: "Incline Chest-Supported Smith Machine Row",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Lower chest", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
    smith: { stopY: 0.34 },
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, knee: 4 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.34, startZ: 0.02, endY: 0.68, endZ: 0.02 },
  },
  hints: {
    start: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 68,
      "shoulder.plane": 76,
      "elbow.flex": 6,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...TRUNK,
      ...GRIP,
      "shoulder.elev": 56,
      "shoulder.plane": 40,
      "elbow.flex": 110,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest on the incline pad. Do not arch the lower back to help the bar up. The Smith bar travels straight up toward the lower chest.",
    ),
    checkNeutralNeck("Tuck your chin enough to keep your face clear of the pad."),
    checkJointRange(
      "smith-incline-row",
      "Bar tracks up to the lower chest",
      "Row the Smith bar straight up toward the lower chest by driving the elbows back and up and pulling the shoulder blades together.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "hang",
      "Arms hang long under the chest",
      "Start with the arms hanging and the elbows straight, shoulder blades spread by the bar.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Take a slightly outside shoulder-width overhand grip so the palms face backward.",
      "forearm_L.pron",
      "start",
      50,
      85,
    ),
    checkJointWithinAt(
      "squeeze",
      "Shoulder blades pinch at the top",
      "Finish with the elbows near shoulder height and the shoulder blades squeezed together.",
      "clavicle_L.prot",
      "peak",
      -28,
      -4,
    ),
  ],
});
