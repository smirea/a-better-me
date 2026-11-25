import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Start with palms facing the lifter and elbows in front; rotate the palms forward as the elbows flare and press. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 8,
  "clavicle.prot": -8,
  "shoulder.elev": 70,
  "shoulder.plane": 84,
  "shoulder.twist": -28,
  "elbow.flex": 100,
  "forearm.pron": -72,
  "wrist.flex": 6,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 6,
  "shoulder.elev": 166,
  "shoulder.plane": 48,
  "shoulder.twist": 18,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "standing-arnold-press",
  catalogId: "2a25c6f170d880f4b962fed4aa60820b",
  name: "Standing Arnold Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Rotate and press", "Lockout", "Lower and rotate", "Front"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 10, balanceZ: 0.1 },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM, "neck.flex": 10 },
    end: { ...TRUNK, ...ARMS_TOP, "neck.flex": -2, "root.pitch": 3 },
  },
  stiffness: { knee: 2.6, elbow: 3, shoulder: 1.1, forearm: 1.8 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 6, 22), lockAngle(body, "knee_R.flex", 6, 22)],
  checks: () => [
    checkFlatBack("Keep the knees and hips straight. Do not lean back through the lower back.", 16),
    checkFeetPlanted("Brace the core and squeeze the glutes so the legs stay quiet."),
    checkJointWithinAt(
      "palms-toward-face",
      "Palms start facing the lifter",
      "Start with the elbows in front of the torso and the palms directed backward.",
      "forearm_L.pron",
      "start",
      -100,
      -40,
    ),
    checkJointWithinAt(
      "palms-forward",
      "Palms finish facing forward",
      "At lockout the palms face forward and the elbows point out to the sides.",
      "forearm_L.pron",
      "peak",
      40,
      100,
    ),
    checkJointRange(
      "rotation",
      "Forearms rotate through the press",
      "Rotate the palms from facing you to facing forward as the elbows flare.",
      "forearm_L.pron",
      90,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Finish with straight elbows and the arms fully overhead.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Arms finish overhead",
      "Press until the shoulders are flexed overhead.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel("bells-rise", "Dumbbells travel upward", "Press the dumbbells from in front of the shoulders to overhead.", "press_L", "y", 0.32),
  ],
});
