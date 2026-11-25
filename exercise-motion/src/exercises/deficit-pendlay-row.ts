import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Low plate under the feet, under 10 cm, bar still on the floor. */
const DEFICIT = 0.08;

const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": 8,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.78 + DEFICIT,
  "root.z": -0.16,
  "root.pitch": 76,
  "hip.flex": 96,
  "hip.abd": 6,
  "knee.flex": 55,
  "ankle.dorsi": 12,
  "lumbar.flex": 8,
  "thoracic.flex": 10,
  "neck.flex": -10,
};

export const spec = buildExerciseSpec({
  id: "deficit-pendlay-row",
  catalogId: "2a05c6f170d88091a3e9e33a249035ae",
  name: "Deficit Pendlay Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Upper abdomen", "Drop", "Dead stop"],
  tempo: { lower: 1.35, bottom: 0.35, raise: 1.15, top: 0.45 },
  stiffness: { knee: 6, hip: 4, lumbar: 5, elbow: 3 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    toeOutDeg: 8,
    torsoLeanDeg: 72,
    box: { height: DEFICIT, width: 0.5, depth: 0.42, z: 0.02 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.32, startZ: 0.28, endY: 0.78, endZ: 0.16, arcBulgeZ: 0.06 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 52,
      "shoulder.plane": 72,
      "elbow.flex": 18,
      "clavicle.prot": -4,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 44,
      "shoulder.plane": 36,
      "elbow.flex": 122,
      "clavicle.prot": -18,
      "clavicle.elev": 12,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat at the bottom while you hinge as close to horizontal as your flexibility permits.",
      18,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are looking straight ahead while standing upright.",
    ),
    checkJointRange(
      "deficit-pull",
      "Longer pull from the floor",
      "Pull the bar from the floor up toward your upper abdomen while you stand on the deficit.",
      "elbow_L.flex",
      80,
    ),
    checkJointWithinAt(
      "feet-elevated-reach",
      "Straight arms reach the floor",
      "With straight elbows, grasp the bar on the ground from the raised stance.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
    checkJointWithinAt(
      "deep-hinge",
      "Torso near horizontal on the deficit",
      "Fully hinge at your hips so the torso is as close to horizontal as a flat lower back allows.",
      "hip_L.flex",
      "start",
      85,
      124,
    ),
    checkJointWithinAt(
      "to-abdomen",
      "Bar finishes at the upper abdomen",
      "Row until the bar is close to your upper abdomen and your elbows are behind your torso or aligned with it.",
      "elbow_L.flex",
      "peak",
      95,
      145,
    ),
  ],
});
