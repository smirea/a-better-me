import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pivot behind the lifter; the working hand rows the sleeve up toward the hip. */
const PIVOT = new Vector3(0.42, 0.06, -1.35);

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": 0.12,
  "root.pitch": 52,
  "hip.flex": 68,
  "hip.abd": 8,
  "knee.flex": 28,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

const WORK_HANG = {
  "clavicle.elev": 4,
  "clavicle.prot": 2,
  "shoulder.elev": 42,
  "shoulder.plane": 72,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 8,
  "wrist.flex": 4,
};

const WORK_ROW = {
  "clavicle.elev": 8,
  "clavicle.prot": -16,
  "shoulder.elev": 30,
  "shoulder.plane": 40,
  "shoulder.twist": 10,
  "elbow.flex": 112,
  "forearm.pron": 8,
  "wrist.flex": 4,
};

const REST = {
  "clavicle.elev": 2,
  "clavicle.prot": -2,
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "shoulder.twist": 6,
  "elbow.flex": 12,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-landmine-row",
  catalogId: "1a15c6f170d880569efcc5eaf99b08ad",
  name: "Single Arm Landmine Row",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Hip", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, heelZ: 0.05, toeOutDeg: 8, torsoLeanDeg: 52 },
  apparatus: { kind: "landmine", pivotZ: PIVOT.z, sides: ["L"] },
  stiffness: { lumbar: 10, thoracic: 8, hip: 7, knee: 5, elbow: 2.4 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const hand = anchorPoint(body, frame, "grip_L");
      push(18 * (hand.distanceTo(PIVOT) - 1.95));
      push(22 * (hand.x - 0.46));
    },
  ],
  hints: {
    start: sidedHints("L", WORK_HANG, REST, HINGE),
    end: sidedHints("L", WORK_ROW, REST, HINGE),
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso fixed in the hinge, with the lower back near neutral and the same bend in the hips and knees throughout the set.",
    ),
    checkNeutralNeck("Keep the neck in line with the hinged torso."),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip on the shaft",
      "Grasp the shaft just behind the bearing with a neutral grip so the palm faces in toward the side.",
      "forearm_L.pron",
      "start",
      -25,
      30,
    ),
    checkJointWithinAt(
      "arm-long",
      "Elbow starts straight",
      "Start with the elbow straight and the plates just clear of the floor so the weight is already loaded.",
      "elbow_L.flex",
      "start",
      0,
      28,
    ),
    checkJointWithinAt(
      "elbow-back",
      "Elbow finishes by the torso",
      "Row until the elbow is level with the torso or slightly behind it, staying fairly close to the side.",
      "elbow_L.flex",
      "peak",
      85,
      135,
    ),
    checkJointRange(
      "row",
      "Elbow bends through the row",
      "Pull the bar up and back toward the torso, then lower until the elbow is straight again.",
      "elbow_L.flex",
      60,
    ),
  ],
});
