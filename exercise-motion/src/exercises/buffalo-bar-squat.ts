import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Buffalo (Duffalo) bar: a gently bowed shaft that sits lower on the back and opens the shoulders.
 * No buffalo-bar mesh exists, so this uses a straight bar with a slightly narrower, more comfortable grip.
 */
const ARMS = {
  "clavicle.prot": -6,
  "clavicle.elev": 8,
  "shoulder.elev": 42,
  "shoulder.plane": -16,
  "shoulder.twist": -42,
  "elbow.flex": 120,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 5,
  "hip.abd": 10,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.53,
  "root.z": -0.06,
  "root.pitch": 22,
  "hip.flex": 110,
  "hip.abd": 16,
  "hip.rot": 8,
  "knee.flex": 118,
  "ankle.dorsi": 24,
  "lumbar.flex": 4,
  "thoracic.flex": 5,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "buffalo-bar-squat",
  catalogId: "39d5c6f170d8800a8bd9f4e2b33c56b8",
  name: "Buffalo Bar Squat",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 2, bottom: 0.2, raise: 1.4, top: 0.5 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 16, trackKnees: 12, rack: { hookY: 1.36, safetyY: 0.58 } },
  apparatus: { kind: "barbell", gripX: 0.36, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Brace and keep the back flat. The bowed shaft reduces the shoulder reach, so the chest can stay up without forcing the wrists.",
      16,
    ),
    checkNeutralNeck("Keep the neck near neutral. The bar should sit on the upper back, not on the bony base of the neck."),
    checkFeetPlanted("Keep the whole sole of each foot planted, with the knees tracking over the toes."),
    checkJointRange(
      "depth",
      "Squat to the available depth",
      "Sit the hips back and bend the knees until the thighs are near parallel, or as deep as you can without the heels rising or the back rounding.",
      "knee_L.flex",
      75,
    ),
    checkJointWithinAt(
      "open-shoulders",
      "Grip stays comfortable on the bowed bar",
      "A buffalo bar curves away from the shoulders so the hands can sit closer in with less external rotation than a straight bar.",
      "elbow_L.flex",
      "bottom",
      100,
      155,
    ),
    checkJointWithinAt(
      "lockout",
      "Stand the hips and knees up",
      "Drive through the floor and extend the hips and knees to stand upright with the bar still on the upper back.",
      "knee_L.flex",
      "top",
      0,
      16,
    ),
  ],
});
