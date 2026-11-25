import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Chest on a low incline. Straight arms, palms forward, sweep out to a T. */
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
  "shoulder.plane": 70,
  "shoulder.twist": -6,
  "elbow.flex": 6,
  "forearm.pron": -8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

const RAISED = {
  ...HANG,
  "shoulder.elev": 102,
  "shoulder.plane": 6,
  "clavicle.elev": 16,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "incline-dumbbell-t-raise",
  catalogId: "1a15c6f170d88076a486ce1243ac39e5",
  name: "Incline Dumbbell T-Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "T", "Lower", "Hang"],
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
      "palms-forward",
      "Palms face forward",
      "Rotate the arms so the palms face forward, and keep them there.",
      "forearm_L.pron",
      "start",
      -30,
      18,
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
      "t-shape",
      "Arms finish in a T",
      "Raise the arms straight out to the sides so they form a T with the torso, at least parallel to the floor.",
      "shoulder_L.plane",
      "peak",
      -12,
      28,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pinch at the top",
      "Squeeze the shoulder blades together at the top as if pinching a pencil between them.",
      "clavicle_L.prot",
      "peak",
      -28,
      -6,
    ),
    checkJointRange(
      "t-raise",
      "Arms travel from a hang to a T",
      "Lower the arms in a controlled manner until they are perpendicular to the ground again.",
      "shoulder_L.elev",
      24,
    ),
  ],
});
