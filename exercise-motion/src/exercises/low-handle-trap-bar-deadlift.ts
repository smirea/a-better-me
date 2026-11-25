import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Z, IDENTITY, type PropDef } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import type { ExerciseSpec } from "../exercise";

/** Low handles are nearly level with the plate sleeves. */
const LOW_TRAP: PropDef = {
  id: "bar",
  kind: "parts",
  parts: [
    { id: "bar.grips", shape: "cylinder", size: [0.016, 0.7, 0], pos: [0, 0, 0], quat: IDENTITY, material: "chrome", collide: true },
    { id: "bar.handleL", shape: "cylinder", size: [0.016, 0.22, 0], pos: [0.31, 0, 0], quat: ALONG_Z, material: "chrome", collide: true },
    { id: "bar.handleR", shape: "cylinder", size: [0.016, 0.22, 0], pos: [-0.31, 0, 0], quat: ALONG_Z, material: "chrome", collide: true },
    { id: "bar.front", shape: "box", size: [0.62, 0.036, 0.036], pos: [0, -0.02, 0.32], quat: IDENTITY, material: "steel", collide: true },
    { id: "bar.back", shape: "box", size: [0.62, 0.036, 0.036], pos: [0, -0.02, -0.32], quat: IDENTITY, material: "steel", collide: true },
    { id: "bar.plateL", shape: "cylinder", size: [0.225, 0.06, 0], pos: [0.55, -0.03, 0], quat: IDENTITY, material: "plate", collide: false },
    { id: "bar.plateR", shape: "cylinder", size: [0.225, 0.06, 0], pos: [-0.55, -0.03, 0], quat: IDENTITY, material: "plate", collide: false },
  ],
};

/** Low handles sit near straight-bar height, so the setup is a deeper squat-hinge. */
const ARMS = {
  "shoulder.plane": 12,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

const built = buildExerciseSpec({
  id: "low-handle-trap-bar-deadlift",
  catalogId: "1a35c6f170d880d0a972d8f5020b8a11",
  name: "Low Handle Trap Bar Deadlift",
  defaultLoadKg: 45,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Handles", "Stand", "Lockout"],
  tempo: { lower: 1.7, bottom: 0.85, raise: 1.35, top: 0.45 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 12 },
  apparatus: {
    kind: "barbell",
    style: "trap",
    gripX: 0.31,
    alignWrists: false,
    path: { startY: 0.78, startZ: 0.04, endY: 0.28, endZ: 0.08, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { thigh_L: 0.04, thigh_R: 0.04, shank_L: 0.045, shank_R: 0.045 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 8, "hip.abd": 8 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.74,
      "root.z": -0.02,
      "root.pitch": 36,
      "hip.flex": 82,
      "hip.abd": 10,
      "knee.flex": 78,
      "ankle.dorsi": 18,
      "shoulder.elev": 14,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack("Keep your lower back flat and your chest up as you reach the low handles.", 16),
    checkNeutralNeck("Keep your neck near a neutral position while you brace and pull."),
    checkJointRange(
      "deep-pull",
      "Deeper than the high-handle pull",
      "Low handles sit near the height of a barbell on the ground, so you bend your hips and knees farther to reach them.",
      "hip_L.flex",
      50,
    ),
    checkJointWithinAt(
      "low-handles",
      "Deep knee bend at the handles",
      "Position the low handles up and stand within the middle of the trap bar with your arms at your sides.",
      "knee_L.flex",
      "bottom",
      60,
      110,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Center your hands on the low handles so the trap bar does not rotate as you lift.",
      "forearm_L.pron",
      "bottom",
      -25,
      25,
    ),
  ],
});

export const spec: ExerciseSpec = {
  ...built,
  build(body) {
    const motion = built.build(body);
    return { ...motion, props: [LOW_TRAP] };
  },
};
