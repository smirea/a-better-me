import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, pin } from "../solver";

/** Prone on the floor, arms in a T with thumbs up, then lifted a short way off the floor. */
const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.26,
  "root.pitch": 82,
  "hip.flex": 2,
  "hip.abd": 8,
  "knee.flex": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": -14,
};

const DOWN = {
  "shoulder.elev": 88,
  "shoulder.plane": 8,
  "shoulder.twist": -8,
  "elbow.flex": 6,
  "forearm.pron": -6,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": -4,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 108,
  "clavicle.elev": 18,
  "clavicle.prot": -10,
};

export const spec = buildExerciseSpec({
  id: "prone-t-raise",
  catalogId: "1a15c6f170d8801ab73ff043efc111f7",
  name: "Prone T-Raise",
  defaultLoadKg: 0,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Lift", "Top", "Lower", "Floor"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "lying", surface: "floor", face: "down", feetOnFloor: false },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.026, share: 0.5, grip: "hang", direction: [0, -1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.026, share: 0.5, grip: "hang", direction: [0, -1, 0] },
    ],
  },
  stiffness: { elbow: 7, shoulder: 0.8, lumbar: 12, thoracic: 10 },
  extraGoals: (body) => [
    pin(body, "pelvisFront", () => new Vector3(0, 0.1, 0.02), 46, "y"),
    pin(body, "chestFront", () => new Vector3(0, 0.1, 0.28), 34, "y"),
    keepAbove(body, "grip_L", 0.03, 16),
    keepAbove(body, "grip_R", 0.03, 16),
    keepAbove(body, "toe_L", 0.02, 14),
    keepAbove(body, "toe_R", 0.02, 14),
  ],
  hints: {
    start: { ...TRUNK, ...DOWN },
    end: { ...TRUNK, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "Keep the chest in contact with the ground. If the chest lifts, the lumbar spine is extending instead of the arms rising from the shoulder girdle.",
    ),
    checkNeutralNeck(
      "Lift the head slightly off the ground and keep a tucked chin with the face directed toward the ground.",
    ),
    checkJointWithinAt(
      "thumbs-up",
      "Thumbs point up",
      "Rotate the arms so the palms face forward. A thumbs-up in this position points the thumb toward the ceiling.",
      "forearm_L.pron",
      "start",
      -35,
      25,
    ),
    checkJointWithinAt(
      "t-shape",
      "Arms form a T",
      "With the elbows extended, hold the arms straight out to the sides so they form a T with the torso.",
      "shoulder_L.plane",
      "start",
      -15,
      28,
    ),
    checkJointRange(
      "t-lift",
      "Arms lift off the floor",
      "Lift the arms off the ground through the available shoulder range while keeping the T shape and the chest down.",
      "shoulder_L.elev",
      12,
    ),
  ],
});
