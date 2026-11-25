import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const LOCKED = {
  "shoulder.elev": 90,
  "shoulder.plane": 74,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

const LOWERED = {
  "shoulder.elev": 58,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 112,
  "forearm.pron": 38,
  "wrist.flex": -8,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
};

export const spec = buildExerciseSpec({
  id: "alternating-dumbbell-bench-press",
  catalogId: "21d5c6f170d880fbabbbf2ef9b066f54",
  name: "Alternating Dumbbell Bench Press",
  defaultLoadKg: 14,
  loadUnit: "perSide",
  laterality: "alternating",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Press", "Switch"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 1.2, top: 0.25 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "dumbbells", sides: ["L", "R"], anchor: "press" },
  hints: {
    start: { ...TRUNK, ...LOCKED },
    end: sidedHints("L", LOWERED, LOCKED, TRUNK),
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while one arm stays locked out."),
    checkJointWithinAt(
      "both-locked",
      "Both elbows start straight",
      "Begin with both dumbbells locked out over the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      36,
    ),
    checkJointWithinAt(
      "working-down",
      "One dumbbell lowers to the chest",
      "Lower one side while the other arm stays straight.",
      "elbow_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointWithinAt(
      "other-locked",
      "The other arm stays locked out",
      "Keep the higher arm motionless and directed up.",
      "elbow_R.flex",
      "bottom",
      0,
      40,
    ),
    checkAnchorTravel(
      "one-side-moves",
      "One dumbbell travels up and down",
      "Only one arm moves at a time after the first lockout.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
