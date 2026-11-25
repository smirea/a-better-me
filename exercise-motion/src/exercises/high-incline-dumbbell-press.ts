import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Bench about 72° from horizontal: flared elbows, palms angled forward, bells over the shoulders at lockout. */
const BOTTOM = {
  ...POSTURE_HINTS.seatedLeanBack,
  "root.pitch": -22,
  "hip.flex": 78,
  "hip.abd": 12,
  "knee.flex": 90,
  "ankle.dorsi": 4,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "clavicle.prot": -10,
  "clavicle.elev": 6,
  "shoulder.elev": 68,
  "shoulder.plane": 72,
  "shoulder.twist": 16,
  "elbow.flex": 98,
  "forearm.pron": 62,
  "wrist.flex": 2,
};

const LOCKOUT = {
  ...BOTTOM,
  "shoulder.elev": 148,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "clavicle.elev": 16,
  "neck.flex": 2,
  "forearm.pron": 58,
};

export const spec = buildExerciseSpec({
  id: "high-incline-dumbbell-press",
  catalogId: "2245c6f170d8808883f9ea2d3b18530a",
  name: "High Incline Dumbbell Press",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 68,
    feetOnFloor: true,
    passiveJoints: ["lumbar", "thoracic", "neck", "hip", "knee", "ankle"],
  },
  extraContacts: {
    "bench.backPad": { head: 0.09, neck: 0.07, girdle: 0.04, chest: 0.04 },
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: { start: BOTTOM, end: LOCKOUT },
  stiffness: { elbow: 4.5, shoulder: 2.4, lumbar: 6 },
  checks: () => [
    checkFeetPlanted("Keep the feet on the floor and the buttocks, upper back, and head on the bench."),
    checkJointRange(
      "elbow-rom",
      "Press from the shoulders",
      "Lower beside the shoulders, then press until the elbows straighten.",
      "elbow_L.flex",
      40,
    ),
    checkJointWithinAt(
      "bottom-elbow",
      "Elbows bent at the shoulders",
      "Descend until the elbows are at or below shoulder level.",
      "elbow_L.flex",
      "start",
      70,
      125,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows locked out",
      "Finish with the elbows straight and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "peak",
      0,
      50,
    ),
    checkJointWithinAt(
      "lockout-shoulder",
      "Shoulders flexed at lockout",
      "Press up the high incline until the arms point toward the ceiling.",
      "shoulder_L.elev",
      "peak",
      110,
      175,
    ),
  ],
});
