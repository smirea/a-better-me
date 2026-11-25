import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, pin } from "../solver";
import { Vector3 } from "three";

/** Seated pullover: elbows stay bent on the pads and sweep from overhead down to the sides. */
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
  id: "pin-loaded-machine-pullover",
  catalogId: "1a15c6f170d880fb835cddd47e531ad0",
  name: "Pin-Loaded Machine Pullover",
  defaultLoadKg: 18,
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
      "Keep the chest up and the back on the pad. Do not flare the ribs or slump as the elbows travel.",
      12,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows stay bent on the pads",
      "Drive the elbows into the arm pads rather than pulling with the hands. The elbows stay bent.",
      "elbow_L.flex",
      "peak",
      75,
      125,
    ),
    checkJointWithinAt(
      "overhead",
      "Elbows start lifted overhead",
      "Let the pads rise until the upper arms are as high as the shoulders comfortably allow, often near vertical.",
      "shoulder_L.elev",
      "top",
      75,
      130,
    ),
    checkJointWithinAt(
      "sides",
      "Elbows finish by the sides",
      "Drive the elbows down toward the sides in an arc. Pull down, then pull back.",
      "shoulder_L.elev",
      "bottom",
      8,
      50,
    ),
    checkJointRange(
      "shoulder-extension",
      "Shoulders extend from overhead to the sides",
      "The rest of the body stays still while the shoulders do the work.",
      "shoulder_L.elev",
      45,
    ),
  ],
});
