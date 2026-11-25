import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";

const HANG = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.32,
  "root.z": -0.12,
  "root.pitch": 4,
  "lumbar.flex": 6,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.flex": 12,
  "hip.abd": 4,
  "knee.flex": 8,
  "ankle.dorsi": -8,
  "clavicle.elev": -6,
  "clavicle.prot": 4,
  "shoulder.elev": 168,
  "shoulder.plane": 28,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 74,
  "wrist.flex": 10,
};

const UP = {
  ...HANG,
  "root.y": 1.22,
  "root.z": -0.02,
  "root.pitch": 14,
  "lumbar.flex": 32,
  "thoracic.flex": 12,
  "hip.flex": 108,
  "knee.flex": 50,
  "ankle.dorsi": 6,
  "clavicle.elev": -4,
};

const base = buildExerciseSpec({
  id: "toes-to-bar",
  catalogId: "3585c6f170d8804c9328f764225cfc6c",
  name: "Toes-To-Bar",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  brace: true,
  phaseLabels: ["Hang", "Lift", "Touch", "Lower"],
  station: { kind: "hanging", barY: 2.32, width: 1.2 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.5, share: 0.5, grip: "hang", direction: [0, 1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.5, share: 0.5, grip: "hang", direction: [0, 1, 0] },
    ],
  },
  stiffness: { hip: 3, knee: 3, lumbar: 10, shoulder: 4, elbow: 6 },
  extraGoals: (body) => [
    pin(body, "sternum", () => new Vector3(0, 1.55, -0.02), 28, "z"),
    pin(body, "pelvisFront", () => new Vector3(0, 1.1, 0.02), 22, "z"),
  ],
  hints: { start: HANG, end: UP },
  checks: () => [
    checkJointRange(
      "hips-flex",
      "Legs lift toward the bar",
      "Lift your legs up and toward your torso while curling your hips forward until you can touch the bar with your toes.",
      "hip_L.flex",
      45,
    ),
    checkJointRange(
      "hips-curl",
      "The lower back curls as the toes rise",
      "Curling your hips forward will round your lower back and result in your buttocks facing forward at the end of the lifting phase.",
      "lumbar.flex",
      16,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Continue keeping your elbows straight, legs together, and shoulder blades pulled down throughout the exercise.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "soft-knee",
      "Knees bend only as much as the toes need",
      "Only let your knees bend to the minimal degree needed for your toes to reach the bar. Avoid a kicking motion.",
      "knee_L.flex",
      "peak",
      20,
      70,
    ),
    checkAnchorTravel(
      "toes-rise",
      "Toes travel up to the bar",
      "Touch the bar with your toes, keeping the legs together so you meet the bar between your hands.",
      "secondToe_L",
      "y",
      0.7,
    ),
    checkJointWithinAt(
      "shoulders-down",
      "Shoulder blades stay pulled down",
      "Pull your shoulder blades down to move your shoulders down away from your ears. Avoid hanging in a shrugged position.",
      "clavicle_L.elev",
      "start",
      -16,
      8,
    ),
  ],
});

export const spec = {
  ...base,
  build(body: Parameters<typeof base.build>[0]) {
    const built = base.build(body);
    built.support = { ...built.support, passive: ["ankle"] };
    return built;
  },
};
