import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Seated, working forearm on the thigh, wrist just past the knee. The free hand rests on the other thigh. */
const ACTIVE = {
  "shoulder.elev": 38,
  "shoulder.plane": 66,
  "shoulder.twist": -16,
  "elbow.flex": 78,
  "forearm.pron": -76,
  "clavicle.elev": 4,
};

const FREE = {
  "shoulder.elev": 28,
  "shoulder.plane": 55,
  "shoulder.twist": 6,
  "elbow.flex": 55,
  "forearm.pron": 20,
  "wrist.flex": 6,
  "clavicle.elev": 2,
};

const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.52,
  "root.pitch": 26,
  "lumbar.flex": 14,
  "thoracic.flex": 16,
  "neck.flex": 8,
  "hip.flex": 80,
  "knee.flex": 92,
};

export const spec = buildExerciseSpec({
  id: "single-arm-dumbbell-wrist-curl",
  catalogId: "2e85c6f170d88053bfc1d0a85ae07939",
  name: "Single Arm Dumbbell Wrist Curl",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.2, bottom: 0.22, raise: 1.3, top: 0.2 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.2,
    heelZ: 0.4,
    leanDeg: 24,
    frame: { type: "flat-bench", zHead: -0.4, zFoot: 0.28 },
  },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "wrist.flex": -42 }, FREE, SIT),
    end: sidedHints("L", { ...ACTIVE, "wrist.flex": 52 }, FREE, SIT),
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Working wrist curls the dumbbell",
      "Lift the dumbbell by curling the wrist until the palm faces toward you.",
      "wrist_L.flex",
      55,
    ),
    checkJointWithinAt(
      "forearm-supported",
      "Working elbow stays bent on the thigh",
      "Rest the forearm on the thigh so the wrist can move on its own.",
      "elbow_L.flex",
      "start",
      50,
      110,
    ),
    checkJointWithinAt(
      "palm-up",
      "Palm stays up",
      "Keep the palm facing up so the curl is wrist flexion.",
      "forearm_L.pron",
      "start",
      -90,
      -45,
    ),
    checkJointWithinAt(
      "knuckles-finish-high",
      "The wrist finishes curled",
      "Finish with the knuckles higher than the wrist.",
      "wrist_L.flex",
      "bottom",
      25,
      75,
    ),
  ],
});
