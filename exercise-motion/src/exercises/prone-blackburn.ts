import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, pin } from "../solver";

/**
 * Prone Blackburn / prone handcuffs: arms stay off the floor and arc from overhead,
 * through a T, to hands stacked behind the low back, then reverse.
 */
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

const OVERHEAD = {
  ...TRUNK,
  "shoulder.elev": 158,
  "shoulder.plane": 84,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 0,
  "clavicle.elev": 14,
  "clavicle.prot": 6,
};

const CUFF = {
  ...TRUNK,
  "shoulder.elev": 40,
  "shoulder.plane": 18,
  "shoulder.twist": -28,
  "elbow.flex": 95,
  "forearm.pron": -40,
  "wrist.flex": 4,
  "clavicle.elev": 6,
  "clavicle.prot": -16,
};

export const spec = buildExerciseSpec({
  id: "prone-blackburn",
  catalogId: "1a15c6f170d880b38b79db68220c1a27",
  name: "Prone Blackburn",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Arc", "Handcuff", "Return", "Overhead"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.8, top: 0.25 },
  station: { kind: "lying", surface: "floor", face: "down", feetOnFloor: false },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "grip_L", bodyweightShare: 0.05, share: 0.5, grip: "hang", direction: [0, -1, 0] },
      { anchor: "grip_R", bodyweightShare: 0.05, share: 0.5, grip: "hang", direction: [0, -1, 0] },
    ],
  },
  stiffness: { elbow: 6, shoulder: 5, lumbar: 12, thoracic: 10 },
  extraGoals: (body) => [
    pin(body, "pelvisFront", () => new Vector3(0, 0.1, 0.02), 46, "y"),
    pin(body, "chestFront", () => new Vector3(0, 0.1, 0.32), 34, "y"),
    keepAbove(body, "grip_L", 0.16, 48),
    keepAbove(body, "grip_R", 0.16, 48),
    keepAbove(body, "toe_L", 0.02, 12),
    keepAbove(body, "toe_R", 0.02, 12),
  ],
  hints: { start: OVERHEAD, end: CUFF },
  checks: () => [
    checkFlatBack(
      "Keep the chest in contact with the ground. If the chest lifts, the lumbar spine is extending instead of the arms moving from the shoulder girdle.",
    ),
    checkNeutralNeck(
      "Lift the head slightly off the ground and keep a tucked chin with the face directed toward the ground.",
    ),
    checkJointWithinAt(
      "overhead-start",
      "Arms start overhead",
      "Start with the arms straight out in front, palms down, the way they would look reaching overhead while standing.",
      "shoulder_L.elev",
      "start",
      135,
      175,
    ),
    checkJointWithinAt(
      "handcuff",
      "Hands finish behind the low back",
      "After passing the T, bend the elbows and bring the hands together behind the back, as if being handcuffed while lying prone.",
      "elbow_L.flex",
      "peak",
      35,
      130,
    ),
    checkJointRange(
      "arc",
      "Arms arc from overhead toward the sides",
      "Sweep the lifted arms toward the sides in an arc like the lowering half of a jumping jack, then reverse the same path.",
      "shoulder_L.elev",
      40,
    ),
  ],
});
