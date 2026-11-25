import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Palms stay in. Upper arms stay in front of the torso instead of flaring out. */
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
  "clavicle.elev": 6,
  "clavicle.prot": -10,
  "shoulder.elev": 72,
  "shoulder.plane": 82,
  "shoulder.twist": 4,
  "elbow.flex": 96,
  "forearm.pron": 2,
  "wrist.flex": 4,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": -2,
  "shoulder.elev": 168,
  "shoulder.plane": 70,
  "shoulder.twist": 2,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "standing-neutral-grip-dumbbell-overhead-press",
  catalogId: "1a05c6f170d88044b720f479bb37d97b",
  name: "Standing Neutral Grip Dumbbell Overhead Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 1.1, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 10, balanceZ: 0.1 },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM, "neck.flex": 12 },
    end: { ...TRUNK, ...ARMS_TOP, "neck.flex": -4, "root.pitch": 3 },
  },
  stiffness: { knee: 2.6, elbow: 3.2, shoulder: 1.15, forearm: 2.4 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 6, 22), lockAngle(body, "knee_R.flex", 6, 22)],
  checks: () => [
    checkFlatBack("Keep the lower back in its natural curve. Do not lean back to finish the press.", 16),
    checkFeetPlanted("Squeeze the glutes and brace the core so the legs stay quiet."),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "Keep the knees and hips straightened throughout the set.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Straighten the elbows with the arms directed straight up.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Dumbbells finish over the shoulders",
      "The elbows arc back until the dumbbells sit vertically over the shoulders.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel("bells-rise", "Dumbbells travel upward", "Press the dumbbells from the front of the shoulders to overhead.", "press_L", "y", 0.35),
    checkJointRange("shoulder-rom", "Shoulders flex overhead", "Primary joint action is shoulder flexion.", "shoulder_L.elev", 70),
    {
      id: "neutral-grip",
      label: "Palms stay facing in",
      cue: "Keep the palms facing each other for the whole press.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° away from a neutral forearm"),
    },
  ],
});
