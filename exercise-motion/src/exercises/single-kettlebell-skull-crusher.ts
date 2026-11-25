import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Lying, both hands on one bell, upper arms vertical over the shoulders. */
const ARMS = {
  "shoulder.elev": 86,
  "shoulder.plane": 78,
  "shoulder.twist": 10,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": -6,
};

export const spec = buildExerciseSpec({
  id: "single-kettlebell-skull-crusher",
  catalogId: "1a15c6f170d8802e9b7ecde43d2af104",
  name: "Single Kettlebell Skull Crusher",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Forehead"],
  tempo: { lower: 1.7, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  stiffness: { elbow: 4, shoulder: 2.6, lumbar: 6, thoracic: 6 },
  hints: {
    start: { ...POSTURE_HINTS.supineFlat, ...ARMS, "elbow.flex": 8 },
    end: { ...POSTURE_HINTS.supineFlat, ...ARMS, "elbow.flex": 100, "shoulder.elev": 82 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.04, 0.22, 0.02], 18, "xz"),
    holdElbowNearShoulder(body, "R", [0.04, 0.22, 0.02], 18, "xz"),
  ],
  checks: () => [
    checkFeetPlanted("Keep both feet on the floor with the knees bent once you are lying down."),
    checkJointWithinAt(
      "elbows-locked",
      "Arms start straight toward the ceiling",
      "Press the kettlebell up until the arms point at the ceiling with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "forehead",
      "Handle finishes above the forehead",
      "Lower the handle until it is just above the forehead, about a 90 degree elbow bend.",
      "elbow_L.flex",
      "bottom",
      75,
      120,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows hinge over the shoulders",
      "Keep the elbows stacked over the shoulders and hinge only at the elbows.",
      "elbow_L.flex",
      70,
    ),
  ],
});
