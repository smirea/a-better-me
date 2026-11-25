import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Flat bench, proud chest, standard angled dumbbells (palms toward the feet). */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 74,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 38,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-bench-press",
  catalogId: "1a05c6f170d8803ba48ec1443eab5978",
  name: "Dumbbell Bench Press",
  defaultLoadKg: 18,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor, about shoulder width, with the knees bent."),
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
      "chest",
      "Dumbbells meet the sides of the chest",
      "Lower until the hands are about level with the chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders move through the press",
      "The press combines shoulder flexion and horizontal flexion.",
      "shoulder_L.elev",
      18,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up from the chest",
      "Press until the arms point up and the elbows are straight.",
      "press_L",
      "y",
      0.18,
    ),
  ],
});
