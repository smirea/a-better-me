import { buildExerciseSpec, holdElbowNearShoulder, keepHandsOnBar, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Lying dual bells, palms angled forward, upper arms vertical. */
const ARMS = {
  "shoulder.elev": 88,
  "shoulder.plane": 48,
  "shoulder.twist": 18,
  "forearm.pron": 55,
  "wrist.flex": -4,
  "clavicle.elev": 4,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "dual-kettlebell-skull-crusher",
  catalogId: "1a15c6f170d880958b3cdace2a59c25c",
  name: "Dual Kettlebell Skull Crusher",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Beside head"],
  tempo: { lower: 1.7, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: { kind: "kettlebells" },
  stiffness: { elbow: 4, shoulder: 2.4, lumbar: 6, thoracic: 6 },
  hints: {
    start: { ...POSTURE_HINTS.supineFlat, ...ARMS, "elbow.flex": 6 },
    end: { ...POSTURE_HINTS.supineFlat, ...ARMS, "elbow.flex": 100, "shoulder.elev": 84 },
  },
  extraGoals: (body) => [
    keepHandsOnBar(body, 0.3, "grip", 28),
    holdElbowNearShoulder(body, "L", [0.14, 0.22, 0.0], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.14, 0.22, 0.0], 16, "xz"),
  ],
  extraContacts: {
    kettlebell_L: { forearm_L: 0.12, upperarm_L: 0.05 },
    kettlebell_R: { forearm_R: 0.12, upperarm_R: 0.05 },
  },
  checks: () => [
    checkFeetPlanted("Keep both feet on the floor with the knees bent."),
    checkJointWithinAt(
      "elbows-locked",
      "Arms start straight toward the ceiling",
      "Press until the elbows are straight and the wrists stack over the shoulders.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "deep-bend",
      "Bells lower beside the head",
      "Bend the elbows past 90 degrees, stopping before the bells meet the bench.",
      "elbow_L.flex",
      "bottom",
      80,
      130,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows hinge with the upper arms vertical",
      "Keep the upper arms vertical and move only at the elbows.",
      "elbow_L.flex",
      65,
    ),
  ],
});
