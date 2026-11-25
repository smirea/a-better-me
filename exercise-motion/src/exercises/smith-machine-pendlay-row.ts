import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.82,
  "root.z": -0.08,
  "root.pitch": 74,
  "hip.flex": 92,
  "hip.abd": 6,
  "knee.flex": 42,
  "ankle.dorsi": 10,
  "lumbar.flex": 8,
  "thoracic.flex": 10,
  "neck.flex": -10,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-pendlay-row",
  catalogId: "2a05c6f170d88048b677f623d7693a19",
  name: "Smith Machine Pendlay Row",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Upper abdomen", "Drop", "Dead stop"],
  tempo: { lower: 1.35, bottom: 0.4, raise: 1.15, top: 0.45 },
  stiffness: { knee: 6, hip: 4, lumbar: 5, elbow: 3 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: -0.08,
    toeOutDeg: 8,
    torsoLeanDeg: 72,
    smith: { stopY: 0.24 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.3, startZ: 0.2, endY: 0.78, endZ: 0.2, arcBulgeZ: 0.02 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 68,
      "shoulder.plane": 78,
      "elbow.flex": 8,
      "clavicle.prot": 8,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 42,
      "shoulder.plane": 36,
      "elbow.flex": 118,
      "clavicle.prot": -18,
      "clavicle.elev": 12,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso hinged and the lower back flat. Every rep starts from a dead stop on the bottom of the machine.",
    ),
    checkNeutralNeck("Keep your neck near neutral, like when you are looking straight ahead while standing upright."),
    checkJointRange(
      "dead-stop-row",
      "Bar leaves the stops for the abdomen",
      "Explosively pull the bar up toward your upper abdomen, then lower it until it rests on the bottom of the machine.",
      "elbow_L.flex",
      80,
    ),
    checkJointWithinAt(
      "straight-arms",
      "Dead stop with straight elbows",
      "Grasp the bar with straight elbows and let it rest at the bottom between reps.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "near-horizontal",
      "Torso stays near horizontal",
      "Keep the same forward torso lean, close to horizontal, through the whole set.",
      "hip_L.flex",
      "peak",
      80,
      120,
    ),
    checkJointWithinAt(
      "elbows-flare",
      "Elbows finish back by the torso",
      "Row until the bar is close to your upper abdomen, with the elbows behind the torso or aligned with it.",
      "elbow_L.flex",
      "peak",
      95,
      145,
    ),
  ],
});
