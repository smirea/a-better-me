import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Wide overhand grip. Hinge stays fixed while the elbows flare up toward the chest. */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": -0.08,
  "root.pitch": 68,
  "hip.flex": 84,
  "hip.abd": 8,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -6,
};

const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "bent-over-barbell-high-row",
  catalogId: "3315c6f170d8801cbe63c44ee31cd133",
  name: "Bent-Over Barbell High Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Chest", "Lower", "Hang"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, torsoLeanDeg: 66 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.46,
    path: { startY: 0.52, startZ: 0.32, endY: 0.86, endZ: 0.22 },
  },
  stiffness: { lumbar: 10, thoracic: 8, elbow: 2, shoulder: 0.7 },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 48,
      "shoulder.plane": 78,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 72,
      "shoulder.plane": 22,
      "elbow.flex": 78,
      "clavicle.prot": -16,
      "clavicle.elev": 14,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso fixed in the hinge, with the same bend in the hips and knees and a flat lower back.",
    ),
    checkNeutralNeck("Keep the neck near neutral, as when looking straight ahead while standing upright."),
    checkJointWithinAt(
      "wide-overhand",
      "Wide overhand grip",
      "Grasp the bar well outside shoulder width with an overhand grip.",
      "forearm_L.pron",
      "start",
      50,
      95,
    ),
    checkJointWithinAt(
      "flared-t",
      "Upper arms flare into a T",
      "Finish with the upper arms and torso close to a T, elbows flared, bar near the chest.",
      "shoulder_L.plane",
      "peak",
      -22,
      40,
    ),
    checkJointRange(
      "high-row",
      "Elbows drive up toward the chest",
      "Pull the bar toward the chest by driving the elbows upward, then lower until the elbows are straight.",
      "elbow_L.flex",
      50,
    ),
  ],
});
