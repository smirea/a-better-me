import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

const SIT = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.52,
  "root.pitch": -4,
  "hip.flex": 78,
  "hip.abd": 8,
  "knee.flex": 82,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "shoulder.elev": 18,
  "shoulder.plane": 36,
  "elbow.flex": 70,
  "forearm.pron": 20,
};

export const spec = buildExerciseSpec({
  id: "machine-tib-raise",
  catalogId: "2f15c6f170d880e5a928ca7855c26785",
  name: "Machine Tib Raise",
  defaultLoadKg: 15,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Pull", "Toes up", "Lower", "Pointed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: -0.02,
    frame: { type: "flat-bench", zHead: -0.55, zFoot: 0.18 },
    feetMode: "hanging",
    passiveJoints: ["hip", "knee"],
  },
  apparatus: {
    kind: "roller-pad",
    trackAnchors: ["toe_L", "toe_R"],
    offset: [0, 0.035, 0],
    forceDir: [0, -1, 0],
    width: 0.42,
    radius: 0.04,
  },
  extraGoals: (body) => [
    pin(body, "heel_L", () => new Vector3(0.12, 0.1, 0.46), 46),
    pin(body, "heel_R", () => new Vector3(-0.12, 0.1, 0.46), 46),
  ],
  stiffness: { ankle: 10, knee: 8 },
  hints: {
    start: { ...SIT, "ankle.dorsi": -32 },
    end: { ...SIT, "ankle.dorsi": 28 },
  },
  checks: () => [
    checkNeutralNeck("Keep the head still. Only the ankles move against the foot pad."),
    checkJointWithinAt(
      "pointed",
      "Toes start pointed down",
      "Let the machine point the toes down away from you to start.",
      "ankle_L.dorsi",
      "start",
      -45,
      -10,
    ),
    checkJointWithinAt(
      "pulled-up",
      "Toes finish above the heels",
      "Pull the toes and the balls of the feet up toward the shins until they sit at least slightly higher than the heels.",
      "ankle_L.dorsi",
      "peak",
      12,
      36,
    ),
    checkJointRange(
      "ankle-dorsiflexion",
      "Both ankles dorsiflex",
      "Pull the balls of the feet upward by moving at the ankles, then lower through the full comfortable range.",
      "ankle_L.dorsi",
      28,
    ),
    checkJointWithinAt(
      "knees-quiet",
      "Knees stay bent and still",
      "Sit close enough that the knees stay bent a bit less than 90 degrees while the ankles work.",
      "knee_L.flex",
      "peak",
      60,
      110,
    ),
  ],
});
