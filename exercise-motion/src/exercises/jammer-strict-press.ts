import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Strict jammer press: same diagonal lever path as the push press, with the legs quiet. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 5,
  "ankle.dorsi": 2,
  "neck.flex": 4,
};

const RACK = {
  "clavicle.elev": 6,
  "clavicle.prot": -2,
  "shoulder.elev": 62,
  "shoulder.plane": 80,
  "shoulder.twist": 8,
  "elbow.flex": 92,
  "forearm.pron": 16,
  "wrist.flex": 2,
};

const LOCKOUT = {
  "clavicle.elev": 18,
  "clavicle.prot": 0,
  "shoulder.elev": 156,
  "shoulder.plane": 40,
  "shoulder.twist": 2,
  "elbow.flex": 10,
  "forearm.pron": 14,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "jammer-strict-press",
  catalogId: "33e5c6f170d880b3a443ec775b903a0b",
  name: "Jammer Strict Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  station: { kind: "standing", stanceX: 0.18, heelZ: 0.08, toeOutDeg: 10, balanceZ: 0.1 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "press",
    forceDir: [0, 0.9, 0.25],
  },
  hints: { start: { ...TRUNK, ...RACK }, end: { ...TRUNK, ...LOCKOUT, "root.pitch": 4 } },
  stiffness: { elbow: 2.8, shoulder: 1.6, knee: 3.2, lumbar: 6 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 6, 22), lockAngle(body, "knee_R.flex", 6, 22)],
  checks: () => [
    checkFlatBack("Brace and press without leaning back. The jammer arms move; the torso stays stacked."),
    checkFeetPlanted("Stand with both feet planted. Do not dip to start the press."),
    checkJointRange(
      "elbow-rom",
      "Press the jammer arms",
      "Press the handles from the shoulders up and forward until the elbows straighten.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "start-elbow",
      "Starts at the shoulders",
      "Begin with the elbows bent and the handles in front of the shoulders.",
      "elbow_L.flex",
      "start",
      70,
      125,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows extend at the top",
      "Finish with the elbows nearly straight along the diagonal jammer path.",
      "elbow_L.flex",
      "peak",
      0,
      26,
    ),
    checkJointWithinAt(
      "legs-still",
      "No leg drive",
      "A strict jammer press keeps the knees nearly straight. Save the dip for the push press.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
  ],
});
