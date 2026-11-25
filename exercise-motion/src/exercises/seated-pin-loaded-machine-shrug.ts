import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Pin-loaded seated shrug. One stack, so the load is total rather than per side. */
const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -2,
  "lumbar.flex": 0,
  "thoracic.flex": 0,
  "neck.flex": 4,
};

const DOWN = {
  "shoulder.elev": 14,
  "shoulder.plane": 26,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": 0,
  "clavicle.elev": -6,
  "clavicle.prot": -2,
};

const UP = { ...DOWN, "clavicle.elev": 26 };

export const spec = buildExerciseSpec({
  id: "seated-pin-loaded-machine-shrug",
  catalogId: "1b95c6f170d880609678f792d0762c00",
  name: "Seated Pin-Loaded Machine Shrug",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.5,
    stanceX: 0.18,
    heelZ: 0.38,
    frame: { type: "machine", backAngleDeg: 86, stackZ: -0.78 },
  },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    forceDir: [0, -1, 0],
    gripX: 0.26,
  },
  stiffness: { elbow: 6, shoulder: 2.4, clavicle: 0.45, lumbar: 7 },
  hints: {
    start: { ...SEAT, ...DOWN },
    end: { ...SEAT, ...UP },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "clavicle_L.elev", -6, 48),
      lockAngle(body, "clavicle_R.elev", -6, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
    end: [
      lockAngle(body, "clavicle_L.elev", 26, 48),
      lockAngle(body, "clavicle_R.elev", 26, 48),
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
    ],
  }),
  checks: () => [
    checkFlatBack("Sit upright after selecting the pin, with the lower back near neutral.", 16),
    checkNeutralNeck("Keep the neck neutral while the handles move."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Grasp the handles with a neutral grip and keep the elbows extended.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Shrug through the available range so the handles rise.",
      "clavicle_L.elev",
      "peak",
      16,
      34,
    ),
    checkJointRange(
      "shrug-rom",
      "Scapulae elevate on the selectorized stack",
      "Lower the shoulders fully, then shrug them straight up.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
