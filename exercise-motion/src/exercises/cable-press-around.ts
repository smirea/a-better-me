import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Standing, split stance, pulley at the working side near lower-chest height.
 * The arm sweeps from a flared elbow out toward the pulley to a straight arm
 * across the chest, hand in front of the opposite shoulder.
 */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 12,
  "hip.flex": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
};

const ACTIVE_OUT = {
  "shoulder.elev": 58,
  "shoulder.plane": 42,
  "shoulder.twist": 12,
  "elbow.flex": 88,
  "forearm.pron": 36,
  "wrist.flex": 0,
  "clavicle.prot": -2,
  "clavicle.elev": 2,
};

const ACTIVE_ACROSS = {
  "shoulder.elev": 70,
  "shoulder.plane": 102,
  "shoulder.twist": 0,
  "elbow.flex": 22,
  "forearm.pron": 24,
  "wrist.flex": 2,
  "clavicle.prot": 10,
  "clavicle.elev": 4,
};

const REST = {
  "shoulder.elev": 22,
  "shoulder.plane": 40,
  "elbow.flex": 28,
  "forearm.pron": 20,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-press-around",
  catalogId: "2ac5c6f170d8805baa6df32488b6181e",
  name: "Cable Press-Around",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Across", "Return", "Out"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: {
    kind: "standing",
    stanceX: 0.12,
    split: { frontSide: "R", frontZ: 0.18, rearZ: -0.14, rearMode: "flat" },
    balanceZ: false,
  },
  apparatus: {
    kind: "cable-single",
    pulley: [0.85, 1.12, 0.05],
    columnPos: [1.0, -0.05],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 5, shoulder: 0.45, lumbar: 8, knee: 4 },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 88, 80),
      lockAngle(body, "shoulder_L.plane", 42, 30),
    ],
    end: [
      lockAngle(body, "elbow_L.flex", 22, 70),
      lockAngle(body, "shoulder_L.plane", 102, 30),
    ],
  }),
  hints: {
    start: sidedHints("L", ACTIVE_OUT, REST, TRUNK),
    end: sidedHints("L", ACTIVE_ACROSS, REST, TRUNK),
  },
  checks: () => [
    checkFlatBack("Keep the chest and hips facing the same way so the cable does not twist the trunk."),
    checkJointWithinAt(
      "elbow-out",
      "Elbow starts flared toward the pulley",
      "Start with the elbow bent and flared out toward the pulley, about level with the chest.",
      "elbow_L.flex",
      "start",
      55,
      110,
    ),
    checkJointWithinAt(
      "across",
      "Arm finishes across the chest",
      "Press across the body until the elbow is in front of the breastbone and the hand is in front of the opposite shoulder.",
      "shoulder_L.plane",
      "peak",
      90,
      145,
    ),
    checkJointRange(
      "horizontal-adduction",
      "The arm sweeps across the chest",
      "Drive the elbow inward as it straightens, then let the cable pull it back out toward the pulley.",
      "shoulder_L.plane",
      40,
    ),
  ],
});
