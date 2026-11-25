import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

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
  id: "single-arm-dumbbell-finger-flexion-wrist-curl",
  catalogId: "2e85c6f170d88005a5c1cb46a7840e3f",
  name: "Single Arm Dumbbell Finger Flexion Wrist Curl",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Curl", "Fist", "Lower", "Roll"],
  tempo: { lower: 1.3, bottom: 0.22, raise: 1.3, top: 0.2 },
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
    start: sidedHints("L", { ...ACTIVE, "wrist.flex": -58 }, FREE, SIT),
    end: sidedHints("L", { ...ACTIVE, "wrist.flex": 48 }, FREE, SIT),
  },
  checks: () => [
    checkJointRange(
      "wrist-and-finger-curl",
      "Wrist and fingers curl the dumbbell",
      "Curl the wrist and close the fingers until the palm faces you and the handle is in the fist.",
      "wrist_L.flex",
      70,
    ),
    checkJointWithinAt(
      "bell-rolled-down",
      "Dumbbell starts rolled toward the fingers",
      "Let the dumbbell roll down the fingers with the palm angled forward.",
      "wrist_L.flex",
      "top",
      -70,
      -28,
    ),
    checkJointWithinAt(
      "forearm-supported",
      "Forearm stays on the thigh",
      "Keep the forearm supported so the wrist and fingers do the lifting.",
      "elbow_L.flex",
      "start",
      50,
      110,
    ),
    checkJointWithinAt(
      "palm-up",
      "Palm stays up",
      "Keep the palm facing up through the curl.",
      "forearm_L.pron",
      "start",
      -90,
      -45,
    ),
  ],
});
