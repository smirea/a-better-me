import { buildExerciseSpec, holdElbowNearShoulder } from "../builders";
import { checkJointRange, checkJointWithinAt, POSTURE_HINTS } from "../postures";

/** Same preacher arm-pad pattern as the pin-loaded extension, plates on the lever. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 16,
  "hip.flex": 78,
  "lumbar.flex": 8,
  "thoracic.flex": 6,
  "neck.flex": 10,
};

const ARMS = {
  "shoulder.elev": 56,
  "shoulder.plane": 84,
  "shoulder.twist": 10,
  "forearm.pron": 40,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-triceps-extension",
  catalogId: "2985c6f170d88033b7dbcb838dbd3faa",
  name: "Plate-Loaded Machine Triceps Extension",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: -0.02,
    heelZ: 0.42,
    leanDeg: 14,
    pinBack: false,
    frame: { type: "machine", backAngleDeg: 78, stackZ: -0.55 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, 0.12, -1],
  },
  stiffness: { elbow: 2, shoulder: 2.2, lumbar: 6 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 128 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 12 },
  },
  extraContacts: {
    handle_L: { girdle: 0.06, upperarm_L: 0.05 },
    handle_R: { girdle: 0.06, upperarm_R: 0.05 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.1, -0.12, 0.16], 8, "xz"),
    holdElbowNearShoulder(body, "R", [0.1, -0.12, 0.16], 8, "xz"),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start nearly fully bent",
      "Sit with the backs of the upper arms on the angled pad and the elbows close to fully bent.",
      "elbow_L.flex",
      "top",
      100,
      145,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows finish straight",
      "Press the handles or pads away until the elbows are fully straightened.",
      "elbow_L.flex",
      "bottom",
      0,
      24,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms arc forward off the pad",
      "Keep the upper arms on the pad. Only the elbows move.",
      "elbow_L.flex",
      85,
    ),
  ],
});
