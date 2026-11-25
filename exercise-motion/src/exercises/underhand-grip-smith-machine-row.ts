import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Near shoulder width, palms forward, elbows tucked. Wrists stay supinated. */
const GRIP = {
  "shoulder.plane": 78,
  "shoulder.twist": -8,
  "forearm.pron": -75,
  "wrist.flex": 6,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.88,
  "root.z": -0.06,
  "root.pitch": 58,
  "hip.flex": 74,
  "hip.abd": 4,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "underhand-grip-smith-machine-row",
  catalogId: "2a15c6f170d8805aaf68ef29976580f7",
  name: "Underhand Grip Smith Machine Row",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Abdomen", "Lower", "Hang"],
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
    gripX: 0.22,
    alignWrists: false,
    path: { startY: 0.52, startZ: 0.16, endY: 0.86, endZ: 0.16 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 50,
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
      "Keep the same hinged torso, flat lower back, and braced core. The Smith bar travels straight up.",
    ),
    checkNeutralNeck("Keep your neck near neutral, as when you are looking straight ahead while standing upright."),
    checkJointRange(
      "underhand-row",
      "Elbows bend while staying tucked",
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
      "hang",
      "Arms hang with extended elbows",
      "Lower the bar until your arms point down with extended elbows, short of the bottom stops.",
      "elbow_L.flex",
      "start",
      0,
      28,
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
