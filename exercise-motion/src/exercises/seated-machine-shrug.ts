import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Seated plate-loaded shrug: tall torso, neutral handles, straight elbows. */
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
  id: "seated-machine-shrug",
  catalogId: "1b85c6f170d88017af62c7f6947b251f",
  name: "Seated Machine Shrug",
  defaultLoadKg: 28,
  loadUnit: "perSide",
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
    checkFlatBack("Sit upright, facing away from the stack, with the lower back near neutral.", 16),
    checkNeutralNeck("Keep the neck neutral as the handles rise and lower."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Hold the handles with a neutral grip and extended elbows.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Shrug the shoulders up through the available range.",
      "clavicle_L.elev",
      "peak",
      16,
      34,
    ),
    checkJointRange(
      "shrug-rom",
      "Scapulae elevate against the pads",
      "Let the shoulders sink, then shrug them straight up without bending the elbows.",
      "clavicle_L.elev",
      20,
    ),
  ],
});
