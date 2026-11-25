import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { balance, pin } from "../solver";
import { Vector3 } from "three";

/** Semi-overhand hang, elbows straight, dumbbells beside the thighs. */
const ARMS = {
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 5,
  "forearm.pron": 45,
  "wrist.flex": 4,
};

const WORK_UP = { "hip.flex": 6, "hip.abd": 3, "knee.flex": 8, "ankle.dorsi": 2 };
const FREE_UP = { "hip.flex": 12, "hip.abd": 10, "knee.flex": 110, "ankle.dorsi": 8 };
const WORK_DOWN = { "hip.flex": 78, "hip.abd": 4, "knee.flex": 20, "ankle.dorsi": 2 };
const FREE_DOWN = { "hip.flex": 18, "hip.abd": 6, "hip.rot": 4, "knee.flex": 55, "ankle.dorsi": 2 };

export const spec = buildExerciseSpec({
  id: "single-leg-dumbbell-romanian-deadlift",
  catalogId: "1a35c6f170d8802ebeecd725059973b2",
  name: "Single Leg Dumbbell Romanian Deadlift",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Stand", "Stacked"],
  tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.08, heelZ: 0.04, toeOutDeg: 4, singleFoot: "L", balanceZ: 0.1 },
  apparatus: { kind: "dumbbells" },
  extraGoals: (body) => [
    balance(body, [{ anchor: "grip_L", kg: 6 }, { anchor: "grip_R", kg: 6 }], 0.1, 70),
    pin(body, "pelvisFront", () => new Vector3(0.1, 0.95, 0.08), 28, "x"),
  ],
  hints: {
    start: sidedHints("L", WORK_UP, FREE_UP, {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.x": 0.16,
      "root.z": 0.04,
      "shoulder.elev": 12,
      "neck.flex": 0,
    }),
    end: sidedHints("L", WORK_DOWN, FREE_DOWN, {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.86,
      "root.x": 0.16,
      "root.z": 0.02,
      "root.pitch": 48,
      "shoulder.elev": 36,
      "neck.flex": -6,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
    }),
  },
  checks: () => [
    checkFlatBack(
      "Keep your elbows straight, core braced, and lower back near a neutral position while you hinge on the working leg.",
      16,
    ),
    checkNeutralNeck(
      "Keep your neck near a neutral position, like when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "working-hinge",
      "Working hip does the hinge",
      "Focus on hinging at the hip of your working leg instead of kicking the free leg back.",
      "hip_L.flex",
      48,
    ),
    checkJointWithinAt(
      "soft-knee",
      "Working knee bends only mildly",
      "Your shin should stay fairly vertical, and you should not keep the working knee fully straightened.",
      "knee_L.flex",
      "bottom",
      8,
      36,
    ),
    checkJointWithinAt(
      "free-leg-back",
      "Free leg reaches back as a counterbalance",
      "Allow your free leg to swing backward as it moves with your torso, while the working sole stays planted.",
      "hip_R.flex",
      "bottom",
      -20,
      28,
    ),
  ],
});
