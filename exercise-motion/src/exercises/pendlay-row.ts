import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

/** Near-horizontal hinge so straight arms reach a full-size plate. */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.8,
  "root.z": -0.1,
  "root.pitch": 74,
  "hip.flex": 92,
  "hip.abd": 6,
  "knee.flex": 48,
  "ankle.dorsi": 10,
  "lumbar.flex": 8,
  "thoracic.flex": 10,
  "neck.flex": -10,
};

export const spec = buildExerciseSpec({
  id: "pendlay-row",
  catalogId: "1a15c6f170d880e9bd65f120ac4908a0",
  name: "Pendlay Row",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Upper abdomen", "Drop", "Dead stop"],
  tempo: { lower: 1.35, bottom: 0.35, raise: 1.15, top: 0.45 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, torsoLeanDeg: 74 },
  stiffness: { knee: 6, hip: 4, lumbar: 5, elbow: 3 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.225, startZ: 0.28, endY: 0.74, endZ: 0.16, arcBulgeZ: 0.08 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 72,
      "shoulder.plane": 78,
      "elbow.flex": 6,
      "clavicle.prot": 10,
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
      "Keep your torso hinged with a flat lower back and your chest up. All the movement comes from the shoulders, shoulder blades, and elbows.",
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are looking straight ahead while standing upright.",
    ),
    checkJointRange(
      "dead-stop-row",
      "Bar travels from the floor to the abdomen",
      "Explosively pull the bar up toward your upper abdomen, then lower it until it is fully resting on the ground.",
      "elbow_L.flex",
      80,
    ),
    checkJointWithinAt(
      "straight-arms",
      "Dead stop with straight elbows",
      "Grasp the bar with straight elbows and let it rest on the ground between reps.",
      "elbow_L.flex",
      "start",
      0,
      22,
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
      "Aim to row the bar until it touches near your upper abdomen, with the elbows behind the torso or aligned with it.",
      "elbow_L.flex",
      "peak",
      95,
      145,
    ),
  ],
});
