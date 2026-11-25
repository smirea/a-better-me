import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Strict standing press: bells beside the shoulders, elbows about 60–75° out, palms angled forward. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -3,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
};

const ARMS_BOTTOM = {
  "clavicle.elev": 6,
  "clavicle.prot": -6,
  "shoulder.elev": 74,
  "shoulder.plane": 58,
  "shoulder.twist": 14,
  "elbow.flex": 94,
  "forearm.pron": 70,
  "wrist.flex": 6,
  "wrist.dev": 2,
};

const ARMS_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 4,
  "shoulder.elev": 168,
  "shoulder.plane": 22,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 66,
  "wrist.flex": 4,
  "wrist.dev": 0,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-overhead-press",
  catalogId: "1a05c6f170d8802ba26bf25efbec5e68",
  name: "Standing Dumbbell Overhead Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 1.1, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 12, balanceZ: 0.1 },
  apparatus: { kind: "dumbbells", anchor: "press" },
  hints: {
    start: { ...TRUNK, ...ARMS_BOTTOM, "neck.flex": 12 },
    end: { ...TRUNK, ...ARMS_TOP, "neck.flex": -4, "root.pitch": 3 },
  },
  stiffness: { knee: 2.6, elbow: 3.2, shoulder: 1.15 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 6, 22), lockAngle(body, "knee_R.flex", 6, 22)],
  checks: () => [
    checkFlatBack(
      "Rather than excessively arching your lower back, maintain the natural curvature of your lower back.",
      16,
    ),
    checkFeetPlanted("Squeeze your glutes and brace your core throughout the press."),
    checkJointWithinAt(
      "knees-straight",
      "Legs stay straight",
      "Keep your knees and hips straightened. Do not use your legs to help lift the weights.",
      "knee_L.flex",
      "peak",
      0,
      16,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked overhead",
      "Finish with the elbows fully straightened and the arms directed straight up.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Dumbbells finish overhead",
      "At lockout the dumbbells sit vertically over the shoulders.",
      "shoulder_L.elev",
      "peak",
      135,
      175,
    ),
    checkAnchorTravel(
      "bells-rise",
      "Dumbbells travel upward",
      "Press the dumbbells upward until the arms are overhead.",
      "press_L",
      "y",
      0.35,
    ),
    checkJointRange(
      "shoulder-rom",
      "Shoulders flex and abduct",
      "Primary joint action is shoulder abduction, with shoulder flexion.",
      "shoulder_L.elev",
      70,
    ),
  ],
});
