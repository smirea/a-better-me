import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/** Low incline, up to about 30° (bench set near 22°). */
const TRUNK = {
  ...POSTURE_HINTS.incline30,
  "root.y": 0.58,
  "root.z": -0.1,
  "root.pitch": -68,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "clavicle.prot": -16,
  "clavicle.elev": 0,
};

const ARMS_TOP = {
  "shoulder.elev": 100,
  "shoulder.plane": 70,
  "shoulder.twist": 30,
  "elbow.flex": 8,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 110,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "low-incline-dumbbell-press",
  catalogId: "2245c6f170d880238f4ff9500137ec89",
  name: "Low Incline Dumbbell Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Mid chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 22,
    stanceX: 0.2,
    heelZ: 0.46,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while you press."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straightened and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      34,
    ),
    checkJointWithinAt(
      "bottom",
      "Dumbbells meet the middle chest",
      "A low incline, up to about 30 degrees, lowers toward the middle chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up",
      "Press the dumbbells up from the bottom of the rep.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
