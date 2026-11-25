import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { balance, pin } from "../solver";
import { Vector3 } from "three";

/** The dumbbell hangs on the side opposite the working leg. */
const LOADED = {
  "shoulder.plane": 36,
  "shoulder.twist": 6,
  "shoulder.elev": 14,
  "elbow.flex": 5,
  "forearm.pron": 48,
  "wrist.flex": 4,
};
const FREE_ARM = {
  "shoulder.plane": 20,
  "shoulder.twist": -10,
  "shoulder.elev": 18,
  "elbow.flex": 22,
  "forearm.pron": 20,
  "wrist.flex": 0,
};

const WORK_UP = { "hip.flex": 6, "hip.abd": 3, "knee.flex": 8, "ankle.dorsi": 2 };
const FREE_UP = { "hip.flex": 12, "hip.abd": 10, "knee.flex": 110, "ankle.dorsi": 8 };
const WORK_DOWN = { "hip.flex": 76, "hip.abd": 4, "knee.flex": 20, "ankle.dorsi": 2 };
const FREE_DOWN = { "hip.flex": 22, "hip.abd": 6, "hip.rot": 4, "knee.flex": 70, "ankle.dorsi": 4 };

export const spec = buildExerciseSpec({
  id: "single-leg-offset-dumbbell-romanian-deadlift",
  catalogId: "2095c6f170d880058b21f3ded8e41d52",
  name: "Single Leg Offset Dumbbell Romanian Deadlift",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.08, heelZ: 0.04, toeOutDeg: 4, singleFoot: "L", balanceZ: 0.1 },
  apparatus: { kind: "dumbbells", sides: ["R"] },
  extraGoals: (body) => [
    balance(body, [{ anchor: "grip_R", kg: 6 }], 0.1, 70),
    pin(body, "pelvisFront", () => new Vector3(0.1, 0.95, 0.08), 32, "x"),
    pin(body, "grip_R", () => new Vector3(0.06, 0.7, 0.16), 18, "x"),
  ],
  hints: {
    start: sidedHints("L", { ...WORK_UP, ...FREE_ARM }, { ...FREE_UP, ...LOADED }, {
      ...POSTURE_HINTS.standing,
      "root.x": 0.2,
      "root.z": 0.04,
      "neck.flex": 0,
      "lumbar.flex": 0,
    }),
    end: sidedHints(
      "L",
      { ...WORK_DOWN, ...FREE_ARM, "shoulder.elev": 28 },
      { ...FREE_DOWN, ...LOADED, "shoulder.elev": 56 },
      {
        ...POSTURE_HINTS.standing,
        "root.y": 0.86,
        "root.x": 0.2,
        "root.z": 0.02,
        "root.pitch": 46,
        "neck.flex": -6,
        "lumbar.flex": 4,
        "thoracic.flex": 4,
      },
    ),
  },
  checks: () => [
    checkFlatBack(
      "Keep your elbow straight, core braced, and lower back flat while the working sole stays on the ground.",
      16,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "working-hinge",
      "Working hip does the hinge",
      "Hinge at the hip opposite the dumbbell, and let the free leg swing back with the torso.",
      "hip_L.flex",
      46,
    ),
    checkJointWithinAt(
      "soft-knee",
      "Working knee bends only mildly",
      "Your shin should stay fairly vertical. Do not lock the working knee or turn the hinge into a squat.",
      "knee_L.flex",
      "bottom",
      8,
      36,
    ),
    checkJointWithinAt(
      "free-leg-back",
      "Free leg reaches back as a counterbalance",
      "Allow the foot on the dumbbell side to lift and swing backward in a see-saw with the torso.",
      "hip_R.flex",
      "bottom",
      -20,
      28,
    ),
  ],
});
