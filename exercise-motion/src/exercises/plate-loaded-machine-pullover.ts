import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Same elbow-driven pullover as the pin-loaded machine. Plates load the lever instead of a stack. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "hip.flex": 86,
  "knee.flex": 90,
};

const ARMS = {
  "shoulder.plane": 72,
  "shoulder.twist": 8,
  "elbow.flex": 100,
  "forearm.pron": 40,
  "wrist.flex": 4,
  "clavicle.prot": -4,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-machine-pullover",
  catalogId: "1a15c6f170d8803a8018d7745dd7b6ce",
  name: "Plate-Loaded Machine Pullover",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Pull", "Elbows in", "Return", "Overhead"],
  tempo: { lower: 1.7, bottom: 0.3, raise: 1.8, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.48,
    seatZ: 0,
    stanceX: 0.18,
    heelZ: 0.38,
    leanDeg: -4,
    frame: { type: "machine", backAngleDeg: 82, stackZ: -0.75 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "horizontal",
    forceDir: [0, 1, -0.1],
  },
  stiffness: { elbow: 6, shoulder: 0.5, lumbar: 10, thoracic: 8 },
  extraGoals: (body) => [
    pin(body, "pelvisBottom", () => new Vector3(0, 0.47, 0), 70),
    lockAngle(body, "elbow_L.flex", 95, 12),
    lockAngle(body, "elbow_R.flex", 95, 12),
  ],
  hints: {
    start: { ...SEAT, ...ARMS, "elbow.flex": 95, "shoulder.elev": 140, "clavicle.elev": 12 },
    end: { ...SEAT, ...ARMS, "elbow.flex": 95, "shoulder.elev": 32, "clavicle.elev": -4 },
  },
  checks: () => [
    checkFlatBack(
      "Keep a proud chest against the backrest. Do not arch the lower back as the elbows rise.",
      12,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows stay bent against the pads",
      "Emphasize driving the elbows down into the arm pads rather than pulling the handles with the hands.",
      "elbow_L.flex",
      "peak",
      75,
      125,
    ),
    checkJointWithinAt(
      "overhead",
      "Elbows start as high as the shoulders allow",
      "On a machine without a pedal, the lever stop may set the top. Reach that stop without shoulder pain.",
      "shoulder_L.elev",
      "top",
      75,
      130,
    ),
    checkJointRange(
      "shoulder-extension",
      "Elbows arc down to the sides and back up",
      "Pull down, then pull back. Control the return so the plates do not swing the arms up.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
