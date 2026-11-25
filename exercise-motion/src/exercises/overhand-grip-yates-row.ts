import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Moderate hinge, bar near the knees, overhand, elbows tucked. */
const GRIP = {
  "shoulder.plane": 76,
  "shoulder.twist": 12,
  "forearm.pron": 75,
  "wrist.flex": 6,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.9,
  "root.z": -0.06,
  "root.pitch": 38,
  "hip.flex": 48,
  "hip.abd": 6,
  "knee.flex": 14,
  "ankle.dorsi": 6,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -6,
};

export const spec = buildExerciseSpec({
  id: "overhand-grip-yates-row",
  catalogId: "2735c6f170d880f3b90ecd520d315d5f",
  name: "Overhand Grip Yates Row",
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
    gripX: 0.24,
    path: { startY: 0.62, startZ: 0.28, endY: 0.9, endZ: 0.18 },
  },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 36,
      "elbow.flex": 6,
      "clavicle.prot": 6,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 28,
      "elbow.flex": 115,
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
      "yates-pull",
      "Elbows drive toward the lower abdomen",
      "Pull the bar up toward your lower abdomen by driving your elbows backward and upward as you pull your shoulder blades back.",
      "elbow_L.flex",
      75,
    ),
    checkJointWithinAt(
      "moderate-hinge",
      "Torso only moderately inclined",
      "Hinge until the bar is near your knees, and keep that inclination instead of lifting the torso more upright.",
      "hip_L.flex",
      "start",
      36,
      70,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the bar with a near shoulder-width overhand grip so your palms face backward.",
      "forearm_L.pron",
      "start",
      50,
      85,
    ),
    checkJointWithinAt(
      "tucked-finish",
      "Elbows stay near the sides",
      "Keep your elbows tucked reasonably close to your sides as they bend, and finish with the bar at your lower abdomen.",
      "elbow_L.flex",
      "peak",
      95,
      140,
    ),
  ],
});
