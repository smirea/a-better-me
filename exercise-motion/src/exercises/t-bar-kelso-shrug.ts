import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/**
 * Chest on the pad of a chest-supported T-bar. After the bar is clear of the
 * stopper, the elbows stay straight and scapular retraction lifts it a short way.
 */
const BENCH_TOP = 0.78;

const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.84,
  "root.z": -0.16,
  "root.pitch": 78,
  "hip.flex": 8,
  "hip.abd": 10,
  "knee.flex": 12,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -10,
};

const GRIP = {
  "shoulder.twist": 8,
  "forearm.pron": 20,
  "wrist.flex": 4,
  "elbow.flex": 6,
  "shoulder.plane": 76,
};

export const spec = buildExerciseSpec({
  id: "t-bar-kelso-shrug",
  catalogId: "2915c6f170d880ccb3f2c234859d384a",
  name: "T-Bar Kelso Shrug",
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
  },
  stiffness: { lumbar: 14, thoracic: 12, hip: 6, knee: 4, elbow: 8, shoulder: 2.4, clavicle: 0.65 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.18,
    path: { startY: 0.36, startZ: 0.04, endY: 0.5, endZ: 0.02 },
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
      "Keep the chest on the pad. The working reps are a scapular shrug, not a bent-elbow row.",
    ),
    checkNeutralNeck("Keep the face clear of the pad and the neck quiet."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "After the bar is clear of the stopper, lower until the elbows are straight, then keep them straight.",
      "elbow_L.flex",
      "peak",
      0,
      20,
    ),
    checkJointWithinAt(
      "close-grip",
      "Hands stay near the T-bar handles",
      "Grasp the close handles, overhand, neutral, or angled, and keep that grip through the set.",
      "forearm_L.pron",
      "start",
      -10,
      55,
    ),
    checkJointWithinAt(
      "retracted",
      "Shoulder blades pinch",
      "Pull the shoulder blades backward and in toward each other to lift the bar a short distance.",
      "clavicle_L.prot",
      "peak",
      -30,
      -8,
    ),
    checkJointRange(
      "scapular-retraction",
      "Shoulder blades travel from a stretch to a pinch",
      "Let the weight pull the shoulder blades fully apart, then pinch them together without bending the elbows.",
      "clavicle_L.prot",
      16,
    ),
  ],
});
