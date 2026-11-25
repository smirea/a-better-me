import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Knees straight and both feet held off the floor. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
  "hip.flex": 8,
  "hip.abd": 3,
  "knee.flex": 6,
  "ankle.dorsi": -6,
};

const ARMS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 72,
  "shoulder.twist": 32,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 56,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "feet-up-dumbbell-bench-press",
  catalogId: "2a65c6f170d880419684e5c8a768ae66",
  name: "Feet-Up Dumbbell Bench Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.15, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.18,
    heelZ: 0.55,
    feetOnFloor: false,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5, knee: 3, hip: 2 },
  extraGoals: (body) => [
    lockAngle(body, "knee_L.flex", 6, 28),
    lockAngle(body, "knee_R.flex", 6, 28),
  ],
  checks: () => [
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight with the feet up",
      "Keep the knees straight so both feet stay off the floor.",
      "knee_L.flex",
      "peak",
      0,
      22,
    ),
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
      "Dumbbells meet the chest",
      "Lower toward the sides of the chest with the feet still up.",
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
