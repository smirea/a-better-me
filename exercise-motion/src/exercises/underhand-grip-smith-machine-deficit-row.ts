import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const DEFICIT = 0.1;

const GRIP = {
  "shoulder.plane": 78,
  "shoulder.twist": -8,
  "forearm.pron": -75,
  "wrist.flex": 6,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.84 + DEFICIT,
  "root.z": -0.08,
  "root.pitch": 70,
  "hip.flex": 90,
  "hip.abd": 4,
  "knee.flex": 28,
  "ankle.dorsi": 10,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "underhand-grip-smith-machine-deficit-row",
  catalogId: "2a15c6f170d88047b9f6f714f2131299",
  name: "Underhand Grip Smith Machine Deficit Row",
  defaultLoadKg: 35,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Abdomen", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: -0.04,
    toeOutDeg: 8,
    torsoLeanDeg: 68,
    box: { height: DEFICIT, width: 0.55, depth: 0.42, z: -0.02 },
    smith: { stopY: 0.32 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    alignWrists: false,
    path: { startY: 0.5, startZ: 0.16, endY: 0.88, endZ: 0.16 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 52,
      "elbow.flex": 8,
      "clavicle.prot": 6,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 32,
      "elbow.flex": 118,
      "clavicle.prot": -14,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge as close to horizontal as a flat back allows while you stand on the deficit. Elbows stay tucked.",
      14,
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral on the raised surface."),
    checkJointRange(
      "underhand-deficit",
      "Tucked elbows pull from the deficit",
      "Pull the bar up toward your upper abdomen with your elbows tucked fairly close to your sides.",
      "elbow_L.flex",
      75,
    ),
    checkJointWithinAt(
      "supinated-grip",
      "Underhand grip",
      "Grasp the bar with a near shoulder-width underhand grip so your palms face forward.",
      "forearm_L.pron",
      "start",
      -85,
      -50,
    ),
    checkJointWithinAt(
      "deep-hinge",
      "Torso nearer horizontal",
      "Sit your hips back on the deficit until a flat back and vertical shins stop you. The bar stays off the stops.",
      "hip_L.flex",
      "start",
      75,
      120,
    ),
    checkJointWithinAt(
      "to-abdomen",
      "Bar finishes at the abdomen",
      "Row until the bar is close to your upper abdomen and your elbows are behind your torso or aligned with it.",
      "elbow_L.flex",
      "peak",
      95,
      145,
    ),
  ],
});
