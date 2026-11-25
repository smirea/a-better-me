import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, pin } from "../solver";

/** Prone, arms overhead, thumbs up, chin mildly tucked, chest and legs on the floor. */
const DOWN = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.2,
  "root.pitch": 82,
  "hip.flex": 6,
  "hip.abd": 6,
  "knee.flex": 4,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 10,
  "shoulder.elev": 148,
  "shoulder.plane": 84,
  "shoulder.twist": -4,
  "elbow.flex": 6,
  "forearm.pron": -10,
  "wrist.flex": 0,
  "clavicle.elev": 6,
};

/** Chest, arms, and feet lift together by arching the lower back and extending the hips. */
const UP = {
  ...DOWN,
  "root.y": 0.18,
  "root.pitch": 72,
  "hip.flex": -12,
  "lumbar.flex": -18,
  "thoracic.flex": -10,
  "neck.flex": 8,
  "shoulder.elev": 170,
  "clavicle.elev": 16,
};

export const spec = buildExerciseSpec({
  id: "superman",
  catalogId: "1a45c6f170d8807cae53dd7f488cd0f3",
  name: "Superman",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lift", "Hold", "Lower", "Floor"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 1.3, top: 2 },
  station: { kind: "lying", surface: "floor", face: "down", feetOnFloor: false },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.04, share: 0.5, grip: "hang", direction: [0, -1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.04, share: 0.5, grip: "hang", direction: [0, -1, 0] },
      { anchor: "toe_L", bodyweightShare: 0.06, share: 0.5, direction: [0, -1, 0] },
      { anchor: "toe_R", bodyweightShare: 0.06, share: 0.5, direction: [0, -1, 0] },
    ],
  },
  stiffness: { lumbar: 4, thoracic: 3.5, hip: 2, elbow: 5, knee: 4, neck: 3 },
  extraGoals: (body) => [
    pin(body, "pelvisFront", () => new Vector3(0, 0.1, 0.02), 50, "y"),
    keepAbove(body, "grip_L", 0.05, 36),
    keepAbove(body, "grip_R", 0.05, 36),
    keepAbove(body, "toe_L", 0.01, 10),
    keepAbove(body, "toe_R", 0.01, 10),
  ],
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "lumbar-arch",
      "Lower back arches to lift the chest",
      "Lift the chest off the floor by arching the lower back. The abdomen and the front of the hips stay down.",
      "lumbar.flex",
      12,
    ),
    checkJointRange(
      "legs-lift",
      "Legs lift with the chest",
      "Lift the feet with the chest by squeezing the glutes, knees straight.",
      "hip_L.flex",
      10,
    ),
    checkJointWithinAt(
      "thumbs-up",
      "Palms face each other",
      "Rotate the arms so the palms face in. A thumbs-up points toward the ceiling.",
      "forearm_L.pron",
      "start",
      -40,
      20,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms reach overhead",
      "Arms stay straight out in front, the way they look when reaching overhead while standing.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkNeutralNeck(
      "Keep a mildly tucked chin with the face toward the floor, and do not move the neck during the set.",
      20,
    ),
  ],
});
