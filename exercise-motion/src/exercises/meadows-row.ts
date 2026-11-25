import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Meadows row: stand side-on to a landmine, staggered stance, overhand grip on the sleeve,
 * and row with the elbow flared out to the side. The torso stays hinged.
 */
const PIVOT = new Vector3(0.55, 0.06, -1.2);

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.82,
  "root.z": 0.22,
  "root.pitch": 62,
  "root.yaw": -18,
  "lumbar.flex": 4,
  "thoracic.flex": 8,
  "neck.flex": -2,
};

const WORK_HANG = {
  "clavicle.elev": 6,
  "clavicle.prot": 4,
  "shoulder.elev": 28,
  "shoulder.plane": 48,
  "shoulder.twist": 18,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 6,
};

const WORK_ROW = {
  "clavicle.elev": 14,
  "clavicle.prot": -8,
  "shoulder.elev": 70,
  "shoulder.plane": 16,
  "shoulder.twist": 22,
  "elbow.flex": 100,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

const REST = {
  "clavicle.elev": 2,
  "clavicle.prot": 0,
  "shoulder.elev": 16,
  "shoulder.plane": 20,
  "shoulder.twist": 8,
  "elbow.flex": 14,
  "forearm.pron": 30,
  "wrist.flex": 0,
};

const LEGS_HANG = {
  "hip.flex": 70,
  "hip.abd": 8,
  "knee.flex": 36,
  "ankle.dorsi": 10,
};

const REAR_LEG = {
  "hip.flex": 48,
  "hip.abd": 6,
  "knee.flex": 18,
  "ankle.dorsi": 6,
};

export const spec = buildExerciseSpec({
  id: "meadows-row",
  catalogId: "1a15c6f170d880008e4bd7c88314ca8a",
  name: "Meadows Row",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Top", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.2, raise: 1.4, top: 0.25 },
  station: {
    kind: "standing",
    stanceX: 0.16,
    toeOutDeg: 8,
    torsoLeanDeg: 62,
    balanceZ: false,
    split: { frontSide: "R", frontZ: 0.42, rearZ: -0.12, rearMode: "flat" },
  },
  apparatus: { kind: "landmine", pivotZ: PIVOT.z, sides: ["L"] },
  stiffness: { lumbar: 10, thoracic: 8, hip: 7, knee: 5, elbow: 2.2, shoulder: 0.9 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const hand = anchorPoint(body, frame, "grip_L");
      push(16 * (hand.distanceTo(PIVOT) - 1.92));
      push(20 * (hand.x - 0.52));
    },
  ],
  hints: {
    start: sidedHints("L", { ...WORK_HANG, ...LEGS_HANG }, { ...REST, ...REAR_LEG }, HINGE),
    end: sidedHints("L", { ...WORK_ROW, ...LEGS_HANG }, { ...REST, ...REAR_LEG }, HINGE),
  },
  checks: () => [
    checkFlatBack(
      "Hinge until the torso is closer to horizontal than vertical, and keep that angle still with the lower back near neutral.",
    ),
    checkNeutralNeck("Keep the neck in line with the hinged torso."),
    checkJointWithinAt(
      "overhand",
      "Overhand grip on the sleeve",
      "Grasp the end of the sleeve with an overhand grip so the palm faces backward.",
      "forearm_L.pron",
      "start",
      50,
      90,
    ),
    checkJointWithinAt(
      "elbow-flares",
      "Elbow flares out to the side",
      "Drive the elbow up and out to the side until the upper arm is close to parallel with the ground.",
      "shoulder_L.elev",
      "peak",
      55,
      110,
    ),
    checkJointWithinAt(
      "arm-long",
      "Elbow starts straight",
      "Start with the elbow extended and the torso already hinged.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointRange(
      "row",
      "Elbow bends as the sleeve rises",
      "Pull the sleeve up with the elbow flared, then lower it under control until the elbow is straight.",
      "elbow_L.flex",
      55,
    ),
  ],
});
