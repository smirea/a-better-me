import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Semi-overhand: palms angle inward and backward, elbows flare about 45°. */
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
  id: "bent-over-kettlebell-row",
  catalogId: "1a15c6f170d8801ba086cdf6a79bd3a4",
  name: "Bent-Over Kettlebell Row",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Elbows high", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 8, torsoLeanDeg: 62 },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: true },
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 50,
      "shoulder.plane": 70,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 42,
      "elbow.flex": 100,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Rigidly maintain a flat lower back with the same bend in your hips and knees. All the motion comes from the upper body.",
    ),
    checkNeutralNeck("Keep your chest up and your neck near neutral while you hinge."),
    checkJointRange(
      "kb-row",
      "Bells arc up and out",
      "Drive your elbows backward, upward, and about 45 degrees out from your sides. The kettlebells arc rather than travel straight up.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hang",
      "Arms hang straight",
      "Start with your arms hanging straight down, palms angled inward and backward.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "semi-overhand",
      "Semi-overhand grip",
      "Direct your palms to angle inward and backward, a hybrid of overhand and neutral.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Pull your shoulder blades back together at the top, as if pinching a pencil between them.",
      "clavicle_L.prot",
      "peak",
      -28,
      -2,
    ),
  ],
});
