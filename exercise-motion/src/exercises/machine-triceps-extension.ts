import { buildExerciseSpec, holdElbowNearShoulder } from "../builders";
import { checkJointRange, checkJointWithinAt, POSTURE_HINTS } from "../postures";

/** Seated preacher-style pad: upper arms rest forward, forearms arc away. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 16,
  "hip.flex": 78,
  "lumbar.flex": 8,
  "thoracic.flex": 6,
  "neck.flex": 10,
};

const ARMS = {
  "shoulder.elev": 58,
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

export const spec = buildExerciseSpec({
  id: "machine-triceps-extension",
  catalogId: "2985c6f170d8800b94d6cc7918bfe6db",
  name: "Machine Triceps Extension",
  defaultLoadKg: 25,
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
    frame: { type: "machine", backAngleDeg: 78, stackZ: -0.72 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, 0.15, -1],
  },
  stiffness: { elbow: 2, shoulder: 2.2, lumbar: 6 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 130 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 12 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.12, 0.16], 8, "xz"),
    holdElbowNearShoulder(body, "R", [0.08, -0.12, 0.16], 8, "xz"),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-bent",
      "Elbows start nearly fully bent",
      "Set the handles back so each rep starts with the elbows close to fully bent on the arm pad.",
      "elbow_L.flex",
      "top",
      100,
      145,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows finish straight",
      "Press the handles away until the elbows are fully straightened.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms arc forward off the pad",
      "Keep the triceps on the pad and move only the forearms.",
      "elbow_L.flex",
      90,
    ),
  ],
});
