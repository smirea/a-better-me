import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { exerciseMat } from "../equipment-library";
import type { ExerciseSpec } from "../exercise";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothToes } from "../postures";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.42,
  "root.pitch": 80,
  "lumbar.flex": 12,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 4,
  "hip.abd": 6,
  "knee.flex": 6,
  "ankle.dorsi": 8,
  "clavicle.prot": 10,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 2,
};

const base = buildExerciseSpec({
  id: "barbell-plank-rollout",
  catalogId: "2875c6f170d880deb312df35b1dbdb52",
  name: "Barbell Plank Rollout",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Plank", "Roll out", "Reach", "Pull back"],
  ground: "ballIn_L",
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 2.3, 0.1),
  apparatus: {
    kind: "barbell",
    anchor: "grip",
    gripX: 0.36,
    path: { startY: 0.225, startZ: 0.55, endY: 0.225, endZ: 0.78 },
  },
  stiffness: { lumbar: 16, thoracic: 12, hip: 8, knee: 6, elbow: 8, shoulder: 2 },
  extraGoals: (body) => plantBothToes(body, 0.11, -0.78, 0.08, 48),
  hints: {
    start: { ...PLANK, "shoulder.elev": 78 },
    end: { ...PLANK, "shoulder.elev": 104 },
  },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes to flatten your lower back so you can draw a straight line from your knees through your hips to your shoulders.",
      12,
    ),
    checkNeutralNeck("Your neck should be near a neutral position, like when you are normally standing upright and looking straight ahead."),
    checkJointRange(
      "bar-rolls",
      "Arms roll the bar forward",
      "Sweep your arms forward to push the bar forward through the range in which you can keep your lower back flat.",
      "shoulder_L.elev",
      16,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "While you push the bar forward through shoulder motion, keep your elbows straightened and the rest of your body stationary.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "hips-extended",
      "Hips stay in the plank line",
      "Particularly avoid letting your hips sag down or your ribs flare up, which will arch your lower back.",
      "hip_L.flex",
      "peak",
      -12,
      22,
    ),
  ],
});

export const spec: ExerciseSpec = {
  ...base,
  build(body) {
    const built = base.build(body);
    built.loads = built.loads.map((load) => ({
      ...load,
      share: 0,
      bodyweightShare: 0.16,
      grip: "press" as const,
      direction: [0, 1, 0] as [number, number, number],
    }));
    return built;
  },
};
