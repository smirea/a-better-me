import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Same moderate hinge as the overhand Yates row, palms forward. */
const GRIP = {
  "shoulder.plane": 80,
  "shoulder.twist": -10,
  "forearm.pron": -75,
  "wrist.flex": 6,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.9,
  "root.z": -0.06,
  "root.pitch": 38,
  "hip.flex": 48,
  "hip.abd": 4,
  "knee.flex": 14,
  "ankle.dorsi": 6,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -6,
};

export const spec = buildExerciseSpec({
  id: "underhand-grip-yates-row",
  catalogId: "1a15c6f170d8808c80a4d05ecedeadc1",
  name: "Underhand Grip Yates Row",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Lower abdomen", "Lower", "Knees"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, torsoLeanDeg: 40 },
  stiffness: { knee: 10, hip: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    alignWrists: false,
    path: { startY: 0.62, startZ: 0.28, endY: 0.9, endZ: 0.16 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 34,
      "elbow.flex": 6,
      "clavicle.prot": 4,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 26,
      "elbow.flex": 120,
      "clavicle.prot": -14,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Maintain the same torso inclination with a flat back, chest up, and your core braced.",
    ),
    checkNeutralNeck("Keep your lower back near a neutral position rather than rounding it."),
    checkJointRange(
      "underhand-yates",
      "Elbows stay tucked on the way up",
      "Pull the bar toward your lower abdomen with your elbows tucked close to your sides.",
      "elbow_L.flex",
      80,
    ),
    checkJointWithinAt(
      "underhand",
      "Underhand grip",
      "Grasp the bar with a near shoulder-width underhand grip so your palms face forward.",
      "forearm_L.pron",
      "start",
      -85,
      -50,
    ),
    checkJointWithinAt(
      "moderate-hinge",
      "Bar starts near the knees",
      "Hinge until the bar is near your knees and keep that torso angle for the whole set.",
      "hip_L.flex",
      "start",
      36,
      70,
    ),
    checkJointWithinAt(
      "to-lower-abdomen",
      "Bar finishes at the lower abdomen",
      "Drive the elbows backward and upward until the bar reaches your lower abdomen.",
      "elbow_L.flex",
      "peak",
      85,
      145,
    ),
  ],
});
