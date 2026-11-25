import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const GRIP = {
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "forearm.pron": 75,
  "wrist.flex": 8,
  "wrist.dev": 2,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.88,
  "root.z": -0.06,
  "root.pitch": 58,
  "hip.flex": 74,
  "hip.abd": 6,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "smith-machine-row",
  catalogId: "2a15c6f170d8803c80eddc3aed1b7914",
  name: "Smith Machine Row",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Upper abdomen", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    heelZ: -0.12,
    toeOutDeg: 8,
    torsoLeanDeg: 56,
    smith: { stopY: 0.4 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.3,
    path: { startY: 0.52, startZ: 0.16, endY: 0.9, endZ: 0.16 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 50,
      "elbow.flex": 8,
      "clavicle.prot": -2,
      "clavicle.elev": 6,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 34,
      "shoulder.plane": 40,
      "elbow.flex": 112,
      "clavicle.prot": -16,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep the same hip and knee bend the whole set, with a flat lower back and your chest up. The bar tracks on the Smith rails.",
    ),
    checkNeutralNeck("Keep your neck near neutral, as when you are looking straight ahead while standing upright."),
    checkJointRange(
      "smith-row",
      "Bar rises along the rails",
      "Pull the bar up toward your upper abdomen by driving your elbows backward and upward.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "hang",
      "Arms hang with straight elbows",
      "Lower the bar until your arms point down toward the ground with straight elbows, short of the bottom stops.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with a slightly outside shoulder-width overhand grip so your palms face backward.",
      "forearm_L.pron",
      "start",
      50,
      85,
    ),
    checkJointWithinAt(
      "to-abdomen",
      "Bar finishes at the upper abdomen",
      "Row until the bar is close to your upper abdomen and your elbows are behind your torso or aligned with it.",
      "elbow_L.flex",
      "peak",
      90,
      140,
    ),
  ],
});
