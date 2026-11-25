import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Chest on a low incline, arms hanging perpendicular to the floor, then raised
 * toward the line of the bench. Palms face each other.
 */
const TRUNK = {
  "root.y": 0.84,
  "root.z": -0.18,
  "root.pitch": 82,
  "hip.flex": 6,
  "hip.abd": 12,
  "knee.flex": 8,
  "ankle.dorsi": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": -12,
};

const HANG = {
  "shoulder.elev": 62,
  "shoulder.plane": 86,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 2,
};

const RAISED = {
  ...HANG,
  "shoulder.elev": 128,
  "clavicle.elev": 18,
  "clavicle.prot": 8,
};

export const spec = buildExerciseSpec({
  id: "incline-dumbbell-i-raise",
  catalogId: "1a15c6f170d880689ebcce6974abf61c",
  name: "Incline Dumbbell I-Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Along bench", "Lower", "Hang"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.5, top: 0.35 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "down",
    benchTopY: 0.78,
    feetOnFloor: false,
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, shoulder: 0.7, lumbar: 10, thoracic: 8 },
  hints: {
    start: { ...TRUNK, ...HANG },
    end: { ...TRUNK, ...RAISED },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest in contact with the bench. If the chest lifts, you are extending the lumbar spine instead of moving only at the shoulder girdle.",
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms face each other",
      "Rotate your arms so that your palms are facing in toward each other, and keep them there.",
      "forearm_L.pron",
      "start",
      -28,
      28,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Keep your elbows extended throughout the set.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "arms-up",
      "Arms rise toward the bench line",
      "Raise your arms straight up out in front of you through your available shoulder range, close to parallel with the incline bench.",
      "shoulder_L.elev",
      "peak",
      100,
      155,
    ),
    checkJointRange(
      "i-raise",
      "Arms travel from a hang to an I",
      "Lower the arms in a controlled manner until they are perpendicular to the ground again.",
      "shoulder_L.elev",
      40,
    ),
  ],
});
