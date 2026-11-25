import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Kneeling tall plank: hips extended, arms vertical over the wheel. */
const IN = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.38,
  "root.z": 0.16,
  "root.pitch": 32,
  "lumbar.flex": 12,
  "thoracic.flex": 6,
  "neck.flex": 4,
  "hip.flex": 8,
  "hip.abd": 8,
  "knee.flex": 88,
  "ankle.dorsi": -30,
  "clavicle.prot": 0,
  "shoulder.elev": 70,
  "shoulder.plane": 78,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 8,
};

/** Arms sweep the wheel forward. Hips stay extended and the low back stays flat. */
const OUT = {
  ...IN,
  "root.y": 0.32,
  "root.z": 0.2,
  "root.pitch": 22,
  "lumbar.flex": 12,
  "thoracic.flex": 8,
  "hip.flex": 8,
  "knee.flex": 90,
  "shoulder.elev": 90,
  "shoulder.plane": 70,
  "shoulder.twist": 0,
  "elbow.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "extended-hip-ab-wheel-rollout",
  catalogId: "1a45c6f170d88092a060d6c6e59dda03",
  name: "Extended-Hip Ab Wheel Rollout",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Plank", "Roll out", "Long", "Pull back"],
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.8, 2.2, 0.35),
  apparatus: { kind: "ab-wheel" },
  stiffness: { hip: 12, lumbar: 16, thoracic: 12, knee: 8, shoulder: 8, elbow: 10, clavicle: 18 },
  extraGoals: (body) => [
    pin(body, "kneeFront_L", () => new Vector3(0.14, 0.05, -0.02), 48),
    pin(body, "kneeFront_R", () => new Vector3(-0.14, 0.05, -0.02), 48),
  ],
  extraRequired: [
    { label: "Left knee on mat", anchor: "kneeFront_L", surfaceY: 0.05, allowSlide: true },
    { label: "Right knee on mat", anchor: "kneeFront_R", surfaceY: 0.05, allowSlide: true },
  ],
  hints: { start: IN, end: OUT },
  checks: () => [
    checkFlatBack(
      "Keep your lower back flat the whole rep. Squeeze your glutes and tighten your abs so your hips do not sag and your ribs do not flare.",
      12,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are standing upright and looking straight ahead."),
    checkJointRange(
      "arms-sweep",
      "Arms sweep the wheel forward",
      "Slowly push the ab wheel forward by sweeping your arms forward, keeping your elbows fully straightened.",
      "shoulder_L.elev",
      18,
    ),
    checkJointWithinAt(
      "hips-stay-extended",
      "Hips stay extended",
      "In contrast to the traditional rollout, you will not bend your hips or move them back during each rep.",
      "hip_L.flex",
      "peak",
      0,
      36,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your elbows fully straightened while you roll out and pull the wheel back.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
  ],
});
