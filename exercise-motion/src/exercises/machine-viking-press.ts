import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/**
 * Standing neutral-grip overhead press on a pivoting lever.
 * The lever itself is not a station kind, so the hands ride neutral machine handles.
 */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
  "neck.flex": 4,
};

const RACK = {
  "clavicle.elev": 6,
  "clavicle.prot": -2,
  "shoulder.elev": 54,
  "shoulder.plane": 88,
  "shoulder.twist": 10,
  "elbow.flex": 100,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const LOCKOUT = {
  "clavicle.elev": 18,
  "clavicle.prot": 0,
  "shoulder.elev": 150,
  "shoulder.plane": 62,
  "shoulder.twist": 2,
  "elbow.flex": 10,
  "forearm.pron": 6,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "machine-viking-press",
  catalogId: "2fe5c6f170d8801682d9ceb13569f0f9",
  name: "Machine Viking Press",
  defaultLoadKg: 25,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Shoulders"],
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, balanceZ: 0.06 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    anchor: "press",
    forceDir: [0, 0.92, 0.28],
    gripX: 0.12,
  },
  hints: { start: { ...TRUNK, ...RACK }, end: { ...TRUNK, ...LOCKOUT, "root.pitch": 2 } },
  stiffness: { elbow: 2.6, shoulder: 1.6, knee: 3, lumbar: 6 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 5, 20), lockAngle(body, "knee_R.flex", 5, 20)],
  checks: () => [
    checkFlatBack("Stand tall inside the machine. Brace and do not lean back to finish the press."),
    checkFeetPlanted("Keep both feet planted. This is a strict standing press, not a push press."),
    checkJointRange(
      "elbow-rom",
      "Press the neutral handles up",
      "Press from the front of the shoulders until the elbows nearly straighten along the lever's arc.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "start-elbow",
      "Starts at the shoulders",
      "Begin with a neutral grip, elbows bent, and the handles in front of the shoulders.",
      "elbow_L.flex",
      "start",
      70,
      125,
    ),
    checkJointWithinAt(
      "lockout-elbow",
      "Elbows extend at the top",
      "Finish with the elbows nearly straight and the handles up in front of the face.",
      "elbow_L.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Neutral grip",
      "Hold the close handles with the palms facing each other.",
      "forearm_L.pron",
      "start",
      0,
      30,
    ),
    checkJointWithinAt(
      "legs-still",
      "Legs stay quiet",
      "Do not dip the knees to drive the lever.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
  ],
});
