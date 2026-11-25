import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, pin } from "../solver";

/**
 * Prone on the floor, arms reaching overhead with thumbs up, then lifted a short
 * way off the floor. Most people cannot raise them far.
 */
const TRUNK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.28,
  "root.pitch": 80,
  "hip.flex": 2,
  "hip.abd": 8,
  "knee.flex": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": -16,
};

const DOWN = {
  "shoulder.elev": 158,
  "shoulder.plane": 84,
  "shoulder.twist": -6,
  "elbow.flex": 6,
  "forearm.pron": -8,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": 4,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 172,
  "clavicle.elev": 22,
  "clavicle.prot": 10,
};

export const spec = buildExerciseSpec({
  id: "prone-i-raise",
  catalogId: "1a15c6f170d8804ba55ed0b633cc01b1",
  name: "Prone I-Raise",
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
      { anchor: "grip_L", bodyweightShare: 0.03, share: 0.5, grip: "hang", direction: [0, -1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.03, share: 0.5, grip: "hang", direction: [0, -1, 0] },
    ],
  },
  stiffness: { elbow: 6, shoulder: 0.8, lumbar: 12, thoracic: 10 },
  extraGoals: (body) => [
    pin(body, "pelvisFront", () => new Vector3(0, 0.1, 0.02), 46, "y"),
    pin(body, "chestFront", () => new Vector3(0, 0.1, 0.42), 34, "y"),
    keepAbove(body, "grip_L", 0.04, 18),
    keepAbove(body, "grip_R", 0.04, 18),
    keepAbove(body, "toe_L", 0.02, 14),
    keepAbove(body, "toe_R", 0.02, 14),
  ],
  hints: {
    start: { ...TRUNK, ...DOWN },
    end: { ...TRUNK, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest in contact with the ground. If the chest lifts, you are extending the lumbar spine instead of moving only at the shoulder girdle.",
    ),
    checkNeutralNeck(
      "Lift your head slightly off the ground and keep a tucked chin with your face directed toward the ground.",
    ),
    checkJointWithinAt(
      "thumbs-up",
      "Palms face each other",
      "Rotate your arms so your palms face in toward each other. A thumbs-up in this position points the thumb toward the ceiling.",
      "forearm_L.pron",
      "start",
      -40,
      25,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms reach overhead",
      "Position your arms straight out in front of you with extended elbows, the way they would look reaching overhead while standing.",
      "shoulder_L.elev",
      "start",
      140,
      175,
    ),
    checkJointRange(
      "i-lift",
      "Arms lift a short way off the floor",
      "Most people will not be able to lift their arms particularly high before reaching the end of their available range of motion.",
      "shoulder_L.elev",
      12,
    ),
  ],
});
