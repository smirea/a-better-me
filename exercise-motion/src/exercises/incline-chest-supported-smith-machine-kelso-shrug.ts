import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/**
 * Incline bench under a Smith bar. Arms hang straight. Scapular retraction
 * lifts the bar a short distance without an elbow bend.
 * Standard cue: chest on the pad, depress and retract the scapulae, elbows locked.
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
  "shoulder.twist": 12,
  "forearm.pron": 74,
  "wrist.flex": 6,
  "elbow.flex": 6,
  "shoulder.plane": 78,
};

export const spec = buildExerciseSpec({
  id: "incline-chest-supported-smith-machine-kelso-shrug",
  catalogId: "39f5c6f170d8803caeeed41c9f9ba7f8",
  name: "Incline Chest-Supported Smith Machine Kelso Shrug",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Retract", "Pinch", "Release", "Hang"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: BENCH_TOP,
    feetOnFloor: false,
    smith: { stopY: 0.36 },
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, knee: 4, elbow: 8, shoulder: 2.4, clavicle: 0.65 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.28,
    path: { startY: 0.36, startZ: 0.02, endY: 0.5, endZ: 0.02 },
  },
  hints: {
    start: { ...TRUNK, ...GRIP, "shoulder.elev": 66, "clavicle.prot": 14, "clavicle.elev": 2 },
    end: { ...TRUNK, ...GRIP, "shoulder.elev": 78, "clavicle.prot": -18, "clavicle.elev": 8 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 6, 40),
      lockAngle(body, "elbow_R.flex", 6, 40),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 6, 40),
      lockAngle(body, "elbow_R.flex", 6, 40),
      lockAngle(body, "clavicle_L.prot", -18, 28),
      lockAngle(body, "clavicle_R.prot", -18, 28),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Keep the chest on the incline pad under the Smith bar. Do not arch the lower back to lift the bar.",
    ),
    checkNeutralNeck("Tuck the chin enough to keep the face clear of the pad."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "With the arms hanging straight down, retract and depress the shoulder blades without bending the elbows.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Hold the Smith bar with a slightly outside shoulder-width overhand grip, palms facing backward.",
      "forearm_L.pron",
      "start",
      50,
      85,
    ),
    checkJointWithinAt(
      "retracted",
      "Shoulder blades pinch at the top",
      "Pull the shoulder blades back and down as far as they go. The bar only rises a short distance.",
      "clavicle_L.prot",
      "peak",
      -30,
      -8,
    ),
    checkJointRange(
      "scapular-retraction",
      "Shoulder blades travel from a hang to a pinch",
      "Let the bar pull the shoulder blades apart at the bottom, then pinch them together to lift it.",
      "clavicle_L.prot",
      16,
    ),
  ],
});
