import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 3,
  "root.roll": -4,
  "lumbar.flex": -3,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 2,
};

const WORK_BOTTOM = {
  "clavicle.elev": 6,
  "clavicle.prot": -6,
  "shoulder.elev": 74,
  "shoulder.plane": 58,
  "shoulder.twist": 14,
  "elbow.flex": 94,
  "forearm.pron": 68,
  "wrist.flex": 6,
};

const WORK_TOP = {
  "clavicle.elev": 18,
  "clavicle.prot": 4,
  "shoulder.elev": 168,
  "shoulder.plane": 22,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 64,
  "wrist.flex": 4,
};

const REST = {
  "clavicle.elev": 2,
  "clavicle.prot": 0,
  "shoulder.elev": 8,
  "shoulder.plane": 16,
  "shoulder.twist": 4,
  "elbow.flex": 12,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "standing-single-arm-dumbbell-overhead-press",
  catalogId: "1a05c6f170d880ad9234c77a643b7d1b",
  name: "Standing Single Arm Dumbbell Overhead Press",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Pause"],
  tempo: { lower: 1.1, bottom: 0.25, raise: 1.5, top: 0.35 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 10, balanceZ: 0.08 },
  apparatus: { kind: "dumbbells", sides: ["L"], anchor: "press" },
  hints: {
    start: sidedHints("L", WORK_BOTTOM, REST, { ...TRUNK, "neck.flex": 10 }),
    end: sidedHints("L", WORK_TOP, REST, { ...TRUNK, "neck.flex": -4, "root.pitch": 2 }),
  },
  stiffness: { knee: 2.6, elbow: 3.2, shoulder: 1.15 },
  extraGoals: (body) => [lockAngle(body, "knee_L.flex", 6, 22), lockAngle(body, "knee_R.flex", 6, 22)],
  checks: () => [
    checkFlatBack("Keep the shoulders level and the lower back in its natural curve.", 16),
    checkFeetPlanted("Squeeze the glutes and brace the core. Do not use the legs to lift the bell."),
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
      "elbow-locked",
      "Working elbow locked overhead",
      "Finish with the working elbow fully straightened.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "overhead-lockout",
      "Dumbbell finishes over the shoulder",
      "The dumbbell finishes vertically over the working shoulder.",
      "shoulder_L.elev",
      "peak",
      140,
      175,
    ),
    checkAnchorTravel("bell-rises", "Dumbbell travels upward", "Press the dumbbell from beside the shoulder to overhead.", "press_L", "y", 0.35),
    checkJointRange("shoulder-rom", "Working shoulder flexes and abducts", "Primary joint action is shoulder abduction.", "shoulder_L.elev", 70),
  ],
});
