import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Seated overhead extension: elbows stay high beside the head, forearms extend up. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 8,
};

const ARMS = {
  "shoulder.elev": 148,
  "shoulder.plane": 74,
  "shoulder.twist": 6,
  "forearm.pron": 10,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-machine-overhead-triceps-extension",
  catalogId: "1a15c6f170d880a8949ec06345dd11d1",
  name: "Pin-Loaded Machine Overhead Triceps Extension",
  defaultLoadKg: 12,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Lower", "Behind head"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.16,
    heelZ: 0.36,
    leanDeg: -4,
    frame: { type: "machine", backAngleDeg: 86, stackZ: -0.7 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, -1, -0.15],
  },
  stiffness: { elbow: 3, shoulder: 2.8, lumbar: 7 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 115 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 12, "shoulder.elev": 148 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, 0.04, -0.02], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, 0.04, -0.02], 16, "xz"),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-bent",
      "Handle starts behind the head",
      "Start with the elbows fully bent and the upper arms beside the head.",
      "elbow_L.flex",
      "top",
      100,
      150,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows lock overhead",
      "Press the handle up until the elbows are fully straight.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms extend overhead",
      "Keep the upper arms still and straighten only the elbows.",
      "elbow_L.flex",
      90,
    ),
  ],
});
