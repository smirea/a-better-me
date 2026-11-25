import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Straighter knees than an RDL, and the bar starts on the floor. */
const ARMS = {
  "shoulder.plane": 84,
  "shoulder.twist": 10,
  "elbow.flex": 5,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "stiff-leg-deadlift-from-floor",
  catalogId: "1f05c6f170d880bdb9abfc920444c84c",
  name: "Stiff-Leg Deadlift From Floor",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Floor", "Stand", "Lockout"],
  tempo: { lower: 2.0, bottom: 0.7, raise: 1.5, top: 0.5 },
  station: { kind: "standing", stanceX: 0.12, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.8, startZ: 0.12, endY: 0.34, endZ: 0.22, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { shank_L: 0.025, shank_R: 0.025, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "knee.flex": 8, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.8,
      "root.z": -0.14,
      "root.pitch": 64,
      "hip.flex": 88,
      "hip.abd": 2,
      "knee.flex": 12,
      "ankle.dorsi": 0,
      "shoulder.elev": 62,
      "neck.flex": -8,
      "lumbar.flex": 6,
      "thoracic.flex": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat and your chest up as you reach the bar on the floor with nearly straight legs.",
      20,
    ),
    checkNeutralNeck("Keep your neck near a neutral position while you hinge to the bar."),
    checkJointRange(
      "long-hinge",
      "Long hip hinge from the floor",
      "While facing the center of the bar, hinge at your hips until your hands reach the bar.",
      "hip_L.flex",
      45,
    ),
    checkJointWithinAt(
      "stiff-knees",
      "Knees stay nearly straight",
      "Keep your knees only softly bent, rather than sinking into a conventional deadlift squat.",
      "knee_L.flex",
      "bottom",
      4,
      24,
    ),
    checkJointWithinAt(
      "floor-depth",
      "Hinge reaches the floor",
      "Adding full-diameter plates elevates the bar to the standard height when deadlifting from the floor.",
      "hip_L.flex",
      "bottom",
      70,
      120,
    ),
  ],
});
