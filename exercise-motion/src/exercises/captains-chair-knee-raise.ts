import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import type { ExerciseSpec } from "../exercise";
import { IDENTITY, type Part } from "../equipment";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { pin } from "../solver";
import { Vector3 } from "three";

const BACK_PAD: Part = {
  id: "chair.back",
  shape: "box",
  size: [0.26, 0.42, 0.06],
  pos: [0, 1.28, -0.16],
  quat: IDENTITY,
  material: "pad",
  collide: false,
};

/** Forearms on the pads, palms in, torso upright against the back pad. */
const HANG = {
  ...POSTURE_HINTS.hanging,
  "root.y": 1.18,
  "root.z": 0.06,
  "root.pitch": 0,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "hip.abd": 6,
  "ankle.dorsi": 4,
  "clavicle.elev": 2,
  "shoulder.elev": 22,
  "shoulder.plane": 78,
  "shoulder.twist": 18,
  "elbow.flex": 95,
  "forearm.pron": 8,
  "wrist.flex": 6,
};

const DOWN = {
  ...HANG,
  "hip.flex": 12,
  "knee.flex": 18,
};

const UP = {
  ...HANG,
  "hip.flex": 112,
  "knee.flex": 118,
  "lumbar.flex": 20,
  "thoracic.flex": 4,
  "root.pitch": 2,
};

const built = buildExerciseSpec({
  id: "captains-chair-knee-raise",
  catalogId: "1a45c6f170d880a7bbdff3def28c12c8",
  name: "Captain's Chair Knee Raise",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  brace: true,
  phaseLabels: ["Hang", "Lift", "Tuck", "Lower"],
  station: { kind: "dip", barY: 1.38, spacing: 0.58 },
  extraEquipment: [BACK_PAD],
  extraContacts: {
    "dip.bar_L": { upperarm_L: 0.045, forearm_L: 0.02 },
    "dip.bar_R": { upperarm_R: 0.045, forearm_R: 0.02 },
  },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "press_L", bodyweightShare: 0.42, grip: "press", direction: [0, 1, 0] },
      { anchor: "press_R", bodyweightShare: 0.42, grip: "press", direction: [0, 1, 0] },
    ],
  },
  extraGoals: (body) => [
    pin(body, "sternum", () => new Vector3(0, 1.5, 0.04), 26, "z"),
    pin(body, "sacrum", () => new Vector3(0, 1.12, 0.02), 22, "z"),
  ],
  stiffness: { hip: 1.2, knee: 1, lumbar: 10, shoulder: 4, elbow: 6 },
  hints: { start: DOWN, end: UP },
  progress: (body, frame) => anchorPoint(body, frame, "kneeFront_L").y,
  checks: () => [
    checkJointRange(
      "knees-march",
      "Knees march up toward the chest",
      "Lift both knees toward the chest through the available range, letting the knees bend as they rise.",
      "knee_L.flex",
      60,
    ),
    checkJointRange(
      "hips-curl",
      "Hips curl forward as the knees rise",
      "Curl the hips forward so the lower back rounds and the buttocks face forward at the top.",
      "hip_L.flex",
      60,
    ),
    checkJointRange(
      "lower-back-round",
      "Lower back rounds at the top",
      "A posterior pelvic tilt rounds the lower back as the knees approach the chest. Keep the upper body still.",
      "lumbar.flex",
      12,
    ),
    checkJointWithinAt(
      "elbows-braced",
      "Elbows stay bent on the arm pads",
      "Bend the elbows and place the forearms on the arm pads while grasping the handles, palms facing in.",
      "elbow_L.flex",
      "start",
      70,
      120,
    ),
    checkJointWithinAt(
      "legs-hang-down",
      "Thighs start directed down",
      "Start with the thighs directed down toward the ground, then lower them back to that line without swinging past it.",
      "hip_L.flex",
      "start",
      -8,
      30,
    ),
  ],
});

/** Dip support marks the hips passive. Keep them active so the hip flexors and abs do the work. */
export const spec: ExerciseSpec = {
  ...built,
  build(body) {
    const frame = built.build(body);
    return {
      ...frame,
      support: {
        ...frame.support,
        passive: ["clavicle", "shoulder", "elbow", "forearm", "wrist"],
      },
    };
  },
};
