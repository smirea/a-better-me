import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const SEAT = {
  ...POSTURE_HINTS.seated,
  "root.pitch": -6,
  "lumbar.flex": -6,
  "thoracic.flex": -4,
  "neck.flex": 8,
  "hip.flex": 86,
  "knee.flex": 88,
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
  "clavicle.elev": 16,
  "clavicle.prot": 6,
  "shoulder.elev": 164,
  "shoulder.plane": 48,
  "shoulder.twist": 18,
  "elbow.flex": 8,
  "forearm.pron": 72,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-arnold-press",
  catalogId: "2a25c6f170d880adb3e5cbe728a1eb05",
  name: "Seated Arnold Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Rotate and press", "Lockout", "Lower and rotate", "Front"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: {
    kind: "seated",
    seatY: 0.43,
    stanceX: 0.18,
    heelZ: 0.36,
    pinHead: false,
    frame: { type: "adjustable-bench", backAngleDeg: 82 },
  },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...SEAT, ...ARMS_BOTTOM, "neck.flex": 10 },
    end: { ...SEAT, ...ARMS_TOP, "neck.flex": 0 },
  },
  stiffness: { elbow: 3, shoulder: 1.1, forearm: 1.8 },
  extraContacts: {
    "bench.backPad": { head: 0.08, neck: 0.06, girdle: 0.04, chest: 0.04 },
  },
  checks: () => [
    checkFlatBack("Keep the chest up against the bench without rounding the upper back."),
    checkFeetPlanted("Keep the feet flat and the buttocks and upper back on the bench."),
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
    checkAnchorTravel("bells-rise", "Dumbbells travel upward", "Press the dumbbells from in front of the shoulders to overhead.", "press_L", "y", 0.3),
  ],
});
