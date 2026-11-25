import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Plate-loaded French press: same overhead elbow path, lever loaded with plates. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 8,
};

const ARMS = {
  "shoulder.elev": 146,
  "shoulder.plane": 76,
  "shoulder.twist": 8,
  "forearm.pron": 12,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-overhead-triceps-extension",
  catalogId: "25c5c6f170d880c1851ce5de31194766",
  name: "Plate-Loaded Machine Overhead Triceps Extension",
  defaultLoadKg: 10,
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
    frame: { type: "machine", backAngleDeg: 86, stackZ: -0.52 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, -1, -0.12],
  },
  stiffness: { elbow: 3, shoulder: 2.8, lumbar: 7 },
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 112 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 14, "shoulder.elev": 146 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, 0.04, -0.02], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, 0.04, -0.02], 16, "xz"),
  ],
  checks: () => [
    checkJointWithinAt(
      "elbows-bent",
      "Handle starts behind the head",
      "Grasp the handle behind the head with the elbows bent and held high.",
      "elbow_L.flex",
      "top",
      100,
      150,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows lock overhead",
      "Press the handle up overhead until the elbows are straight.",
      "elbow_L.flex",
      "bottom",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Forearms extend overhead",
      "Keep the upper arms stationary beside the head.",
      "elbow_L.flex",
      90,
    ),
  ],
});
