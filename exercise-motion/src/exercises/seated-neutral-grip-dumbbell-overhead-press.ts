import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Upright bench, palms in, upper arms in front of the chest. */
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
  "clavicle.prot": -12,
  "shoulder.elev": 74,
  "shoulder.plane": 82,
  "shoulder.twist": 2,
  "elbow.flex": 98,
  "forearm.pron": 2,
  "wrist.flex": 4,
};

const ARMS_TOP = {
  "clavicle.elev": 16,
  "clavicle.prot": -2,
  "shoulder.elev": 166,
  "shoulder.plane": 70,
  "shoulder.twist": 0,
  "elbow.flex": 8,
  "forearm.pron": 4,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "seated-neutral-grip-dumbbell-overhead-press",
  catalogId: "1a05c6f170d88000945dfdee74e96234",
  name: "Seated Neutral Grip Dumbbell Overhead Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 1.15, bottom: 0.25, raise: 1.5, top: 0.3 },
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
    start: { ...SEAT, ...ARMS_BOTTOM, "neck.flex": 12 },
    end: { ...SEAT, ...ARMS_TOP, "neck.flex": -2 },
  },
  stiffness: { elbow: 3.2, shoulder: 1.15, forearm: 2.4 },
  extraContacts: {
    "bench.backPad": { head: 0.08, neck: 0.06, girdle: 0.04, chest: 0.04 },
  },
  checks: () => [
    checkFlatBack("Keep a proud chest without excessively arching the lower back."),
    checkFeetPlanted("Keep the feet flat and the buttocks, upper back, and head on the bench."),
    checkJointWithinAt(
      "bells-at-shoulders",
      "Dumbbells start in front of the shoulders",
      "Lower until the elbows are below the shoulders with the forearms vertical.",
      "elbow_L.flex",
      "start",
      75,
      125,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Press until the elbows are fully straightened overhead.",
      "elbow_L.flex",
      "peak",
      0,
      32,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Arms finish overhead",
      "The elbows arc back until the dumbbells sit over the shoulders.",
      "shoulder_L.elev",
      "peak",
      135,
      175,
    ),
    checkAnchorTravel("bells-rise", "Dumbbells travel upward", "Press the dumbbells from the front of the shoulders to overhead.", "press_L", "y", 0.32),
    checkJointRange("shoulder-rom", "Shoulders flex overhead", "Primary joint action is shoulder flexion.", "shoulder_L.elev", 60),
    {
      id: "neutral-grip",
      label: "Palms stay facing in",
      cue: "Keep the palms facing each other for the whole press.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° away from a neutral forearm"),
    },
  ],
});
