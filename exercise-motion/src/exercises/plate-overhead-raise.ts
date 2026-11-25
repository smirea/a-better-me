import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Same plate pinch as the front raise, continued overhead through available flexion. */
const DOWN = {
  "shoulder.elev": 20,
  "shoulder.plane": 86,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const UP = {
  ...DOWN,
  "shoulder.elev": 158,
  "shoulder.plane": 82,
  "clavicle.elev": 22,
  "clavicle.prot": 8,
};

export const spec = buildExerciseSpec({
  id: "plate-overhead-raise",
  catalogId: "2965c6f170d880048dd3e2730c6ecf96",
  name: "Plate Overhead Raise",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Raise", "Overhead", "Lower", "Thighs"],
  tempo: { lower: 1.8, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "plate", twoHandsOnOne: true },
  stiffness: { elbow: 6, shoulder: 0.65, lumbar: 10, thoracic: 8 },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...DOWN },
    end: { ...POSTURE_HINTS.standing, ...UP },
  },
  checks: () => [
    checkFlatBack(
      "Rather than excessively arching your lower back and leaning backward, keep your lower back near a neutral position.",
      12,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Raise the plate overhead while keeping your elbows straight.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhead",
      "Arms finish near vertical",
      "People can typically lift their arms up until they are close to being fully vertical.",
      "shoulder_L.elev",
      "peak",
      135,
      175,
    ),
    checkJointRange(
      "shoulder-flexion",
      "Plate arcs from the thighs to overhead",
      "The plate should move in an arcing motion, sweeping forward and upward before sweeping backward and upward.",
      "shoulder_L.elev",
      100,
    ),
  ],
});
