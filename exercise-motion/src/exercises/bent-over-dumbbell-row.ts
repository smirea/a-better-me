import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Semi-overhand hinge. Elbows flare about 45° and the torso stays fixed. */
const GRIP = {
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": -0.08,
  "root.pitch": 64,
  "hip.flex": 82,
  "hip.abd": 8,
  "knee.flex": 24,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "bent-over-dumbbell-row",
  catalogId: "1a15c6f170d8802b95b4cce475976c58",
  name: "Bent-Over Dumbbell Row",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Flare", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 8, torsoLeanDeg: 62 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 50,
      "shoulder.plane": 68,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 18,
      "elbow.flex": 100,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep a flat lower back and the same bend in your hips and knees. All the motion comes from the upper body.",
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral while you hinge."),
    checkJointRange(
      "db-row",
      "Dumbbells arc up and out",
      "Drive your elbows backward, upward, and about 45 degrees out from your sides.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "semi-overhand",
      "Semi-overhand grip",
      "Angle your palms inward and backward so each elbow points diagonally out and back.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "flare",
      "Elbows finish flared",
      "Finish with the elbows slightly above your sides, flared about 45 degrees.",
      "shoulder_L.plane",
      "peak",
      8,
      28,
    ),
  ],
});
