import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothToes } from "../postures";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.4,
  "root.pitch": 82,
  "lumbar.flex": 12,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 6,
  "ankle.dorsi": 8,
  "clavicle.prot": 10,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 4,
  "shoulder.twist": -12,
  "shoulder.plane": 100,
};

export const spec = buildExerciseSpec({
  id: "ab-wheel-plank-rollout",
  catalogId: "2875c6f170d880cfbe0bf23d4f700d8f",
  name: "Ab Wheel Plank Rollout",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Plank", "Roll out", "Reach", "Pull back"],
  ground: "ballIn_L",
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 2.2, 0),
  apparatus: { kind: "ab-wheel" },
  stiffness: { lumbar: 16, thoracic: 12, hip: 8, knee: 6, elbow: 8, shoulder: 14 },
  extraGoals: (body) => plantBothToes(body, 0.11, -0.78, 0.08, 48),
  hints: {
    start: { ...PLANK, "shoulder.elev": 74 },
    end: { ...PLANK, "shoulder.elev": 80 },
  },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes to flatten your lower back so you can draw a straight line from your knees through your hips to your shoulders.",
      12,
    ),
    checkNeutralNeck("Your neck should be near a neutral position, like when you are normally standing upright and looking straight ahead."),
    checkJointRange(
      "arms-roll-forward",
      "Arms sweep the wheel forward",
      "Sweep your arms forward to push the ab wheel through the range where you can keep your lower back flat, keeping your elbows straightened.",
      "shoulder_L.elev",
      4,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "While you push the ab wheel forward through shoulder motion, keep your elbows straightened and the rest of your body stationary.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "hips-stay-extended",
      "Hips stay extended in the plank",
      "Particularly avoid letting your hips sag down or your ribs flare up, which will arch your lower back.",
      "hip_L.flex",
      "peak",
      -12,
      22,
    ),
  ],
});
