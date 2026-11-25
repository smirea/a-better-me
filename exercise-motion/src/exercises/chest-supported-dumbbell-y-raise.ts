import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Chest on a low incline. Straight arms sweep from a hang into a Y. */
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
  "shoulder.plane": 78,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const RAISED = {
  ...HANG,
  "shoulder.elev": 124,
  "shoulder.plane": 48,
  "clavicle.elev": 20,
  "clavicle.prot": -6,
};

export const spec = buildExerciseSpec({
  id: "chest-supported-dumbbell-y-raise",
  catalogId: "1a15c6f170d880b0a06fdce7d1c48a03",
  name: "Chest-Supported Dumbbell Y-Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Y", "Lower", "Hang"],
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
      "Keep the chest in contact with the bench. If the chest lifts, the lumbar spine is extending instead of the arms rising from the shoulder girdle.",
    ),
    checkJointWithinAt(
      "angled-grip",
      "Palms stay angled in and somewhat forward",
      "Rotate the arms so the palms face at an angle in toward each other and somewhat forward, and keep them there.",
      "forearm_L.pron",
      "start",
      8,
      50,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Keep the elbows extended throughout the set.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "y-shape",
      "Arms finish in a Y",
      "Raise the arms upward and outward so they form a Y with the torso, close to parallel with the incline bench.",
      "shoulder_L.elev",
      "peak",
      100,
      155,
    ),
    checkJointRange(
      "y-raise",
      "Arms travel from a hang to a Y",
      "Lower the arms in a controlled manner until they are perpendicular to the ground again.",
      "shoulder_L.elev",
      40,
    ),
  ],
});
