import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Z, IDENTITY, type PropDef } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import type { ExerciseSpec } from "../exercise";

/** Handles sit above the sleeves. The first part is a shaft through both grips so contact can see either hand. */
const HIGH_TRAP: PropDef = {
  id: "bar",
  kind: "parts",
  parts: [
    { id: "bar.grips", shape: "cylinder", size: [0.016, 0.7, 0], pos: [0, 0, 0], quat: IDENTITY, material: "chrome", collide: true },
    { id: "bar.handleL", shape: "cylinder", size: [0.016, 0.22, 0], pos: [0.31, 0, 0], quat: ALONG_Z, material: "chrome", collide: true },
    { id: "bar.handleR", shape: "cylinder", size: [0.016, 0.22, 0], pos: [-0.31, 0, 0], quat: ALONG_Z, material: "chrome", collide: true },
    { id: "bar.front", shape: "box", size: [0.62, 0.036, 0.036], pos: [0, -0.16, 0.32], quat: IDENTITY, material: "steel", collide: true },
    { id: "bar.back", shape: "box", size: [0.62, 0.036, 0.036], pos: [0, -0.16, -0.32], quat: IDENTITY, material: "steel", collide: true },
    { id: "bar.plateL", shape: "cylinder", size: [0.225, 0.06, 0], pos: [0.55, -0.18, 0], quat: IDENTITY, material: "plate", collide: false },
    { id: "bar.plateR", shape: "cylinder", size: [0.225, 0.06, 0], pos: [-0.55, -0.18, 0], quat: IDENTITY, material: "plate", collide: false },
  ],
};

/** High handles sit well above a straight-bar floor pull, so the knees stay higher. */
const ARMS = {
  "shoulder.plane": 15,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

const built = buildExerciseSpec({
  id: "high-handle-trap-bar-deadlift",
  catalogId: "1a35c6f170d880e09409ca60499f2367",
  name: "High Handle Trap Bar Deadlift",
  defaultLoadKg: 48,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Handles", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.85, raise: 1.3, top: 0.45 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 10 },
  apparatus: {
    kind: "barbell",
    style: "trap",
    gripX: 0.31,
    alignWrists: false,
    path: { startY: 0.8, startZ: 0.1, endY: 0.56, endZ: 0.16, arcBulgeZ: 0.06 },
  },
  extraContacts: { bar: { thigh_L: 0.04, thigh_R: 0.04, shank_L: 0.04, shank_R: 0.04 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 8, "hip.abd": 8 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.82,
      "root.z": -0.02,
      "root.pitch": 28,
      "hip.flex": 55,
      "hip.abd": 8,
      "knee.flex": 30,
      "ankle.dorsi": 12,
      "shoulder.elev": 16,
      "lumbar.flex": 3,
      "thoracic.flex": 4,
      "neck.flex": -2,
    },
  },
  checks: () => [
    checkFlatBack("Keep your chest up and your back flat while you stand up inside the trap bar.", 12),
    checkNeutralNeck("Keep your neck near neutral and look ahead as you pull."),
    checkJointRange(
      "stand-up",
      "Hips and knees extend",
      "Stand within the middle of the trap bar and drive up until you are fully upright.",
      "knee_L.flex",
      25,
    ),
    checkJointWithinAt(
      "high-handles",
      "Less knee bend than a low-handle pull",
      "High handles let you grasp the bar with your hands elevated more than when grasping a barbell on the ground.",
      "knee_L.flex",
      "bottom",
      18,
      55,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip on the handles",
      "Grasp the high handles beside your thighs with your arms at your sides.",
      "forearm_L.pron",
      "start",
      -25,
      25,
    ),
  ],
});

export const spec: ExerciseSpec = {
  ...built,
  build(body) {
    const motion = built.build(body);
    return { ...motion, props: [HIGH_TRAP] };
  },
};
