import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Supine on a 45° bench. Arms hang, then flex until the hands are near shoulder height. */
const DOWN = {
  "shoulder.elev": 34,
  "shoulder.plane": 82,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 78,
  "shoulder.plane": 84,
  "clavicle.elev": 10,
  "clavicle.prot": 2,
};

const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "incline-dumbbell-front-raise",
  catalogId: "2965c6f170d8803c98cff1ab8fc0bf1e",
  name: "Incline Dumbbell Front Raise",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Shoulder height", "Lower", "Hang"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.4, top: 0.35 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.22,
    heelZ: 0.42,
    frame: { type: "adjustable-bench", backAngleDeg: 45 },
  },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, shoulder: 0.7, lumbar: 8 },
  hints: {
    start: { ...TRUNK, ...DOWN },
    end: { ...TRUNK, ...UP },
  },
  extraContacts: {
    "bench.backPad": { pelvis: 0.05, abdomen: 0.04, girdle: 0.045, chest: 0.04, head: 0.03 },
    "bench.seatPad": { thigh_L: 0.05, thigh_R: 0.05, thighShaft_L: 0.05, thighShaft_R: 0.05 },
  },
  checks: () => [
    checkFlatBack(
      "Keep your upper back and the back of your head in contact with the bench throughout the set.",
    ),
    checkJointWithinAt(
      "arms-down",
      "Arms start pointing down",
      "Direct your arms straight down toward the ground with straight elbows.",
      "shoulder_L.elev",
      "start",
      4,
      40,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "While keeping your elbows straight, sweep the dumbbells forward and upward.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "hands-up",
      "Hands finish near shoulder height",
      "Sweep the dumbbells forward and upward in an arcing motion until your hands are near shoulder height.",
      "shoulder_L.elev",
      "peak",
      58,
      100,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Shoulders flex through the raise",
      "All the movement should occur from shoulder girdle motion, while you keep the rest of your body stationary.",
      "shoulder_L.elev",
      35,
    ),
  ],
});
