import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { exerciseMat } from "../equipment-library";
import type { ExerciseSpec } from "../exercise";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { plantToe } from "../solver";
import { Vector3 } from "three";

/** Kneeling plank: knees down, hips extended so thighs and torso make one line. */
const LINE = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.46,
  "root.z": 0.06,
  "root.pitch": 64,
  "lumbar.flex": 12,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 98,
  "ankle.dorsi": -28,
  "clavicle.prot": 8,
  "shoulder.plane": 86,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 2,
};

const base = buildExerciseSpec({
  id: "extended-hip-barbell-rollout",
  catalogId: "2875c6f170d880a3b551e60c99268218",
  name: "Extended-Hip Barbell Rollout",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Set", "Roll out", "Reach", "Pull back"],
  station: { kind: "kneeling", mat: true },
  extraEquipment: exerciseMat(0.9, 2.1, 0.35),
  apparatus: {
    kind: "barbell",
    anchor: "grip",
    gripX: 0.36,
    alignWrists: true,
    path: { startY: 0.225, startZ: 0.52, endY: 0.225, endZ: 0.92 },
  },
  stiffness: { lumbar: 16, thoracic: 12, hip: 8, knee: 5, elbow: 8, shoulder: 2 },
  extraGoals: (body) => [
    ...plantToe(body, "L", new Vector3(0.14, 0.08, -0.4), 0, 120),
    ...plantToe(body, "R", new Vector3(-0.14, 0.08, -0.4), 0, 120),
  ],
  hints: {
    start: { ...LINE, "shoulder.elev": 72 },
    end: { ...LINE, "shoulder.elev": 112 },
  },
  checks: () => [
    checkFlatBack(
      "Scoop your hips and keep your ribs pulled down so your lower back stays flat. You should be able to draw a straight line from your thighs through your hips to your lower back.",
      12,
    ),
    checkNeutralNeck("Your neck should be near a neutral position, like when you are normally standing upright and looking straight ahead."),
    checkJointRange(
      "bar-rolls-forward",
      "The arms roll the bar forward",
      "Slowly push the bar forward by sweeping your arms forward. Keep your elbows fully straightened and the rest of your body stationary.",
      "shoulder_L.elev",
      28,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your wrists and elbows straight throughout this exercise.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "hips-do-not-fold",
      "Hips stay extended",
      "In contrast to the traditional rollout, you will not bend your hips or move them back during each rep.",
      "hip_L.flex",
      "peak",
      0,
      36,
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
