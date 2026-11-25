import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Moderate incline near 45°, standard angled dumbbells over the upper chest. */
const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.62,
  "root.z": -0.18,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 10,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
};

const ARMS_TOP = {
  "shoulder.elev": 116,
  "shoulder.plane": 70,
  "shoulder.twist": 28,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 66,
  "shoulder.plane": 8,
  "shoulder.twist": 12,
  "elbow.flex": 108,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "45-deg-incline-dumbbell-press",
  catalogId: "1a05c6f170d8806b911acf558c5af4f6",
  name: "45° Incline Dumbbell Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Upper chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.25, top: 0.55 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 45,
    stanceX: 0.2,
    heelZ: 0.48,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor under the bent knees."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the arms directed up and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      34,
    ),
    checkJointWithinAt(
      "upper-chest",
      "Dumbbells meet the upper chest",
      "Lower toward the sides of the upper chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders move through the incline press",
      "The press combines shoulder flexion and horizontal flexion.",
      "shoulder_L.elev",
      20,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up",
      "Press the dumbbells up from the upper chest.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
