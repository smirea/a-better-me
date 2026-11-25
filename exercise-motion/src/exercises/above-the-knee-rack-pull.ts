import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pins sit just above the knee so the bar starts against the lower thigh. */
const PIN_Y = 0.56;

const ARMS = {
  "shoulder.plane": 82,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "above-the-knee-rack-pull",
  catalogId: "2335c6f170d880b2a5ecfddaa83b937c",
  name: "Above-The-Knee Rack Pull",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pins", "Stand", "Lockout"],
  tempo: { lower: 1.6, bottom: 0.8, raise: 1.2, top: 0.45 },
  station: {
    kind: "standing",
    stanceX: 0.13,
    toeOutDeg: 8,
    rack: { hookY: 1.42, safetyY: PIN_Y, zCenter: 0.16 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.22,
    path: { startY: 0.78, startZ: 0.14, endY: PIN_Y + 0.02, endZ: 0.2, arcBulgeZ: 0.03 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "hip.abd": 4, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.88,
      "root.z": -0.08,
      "root.pitch": 42,
      "hip.flex": 58,
      "hip.abd": 4,
      "knee.flex": 18,
      "ankle.dorsi": 4,
      "shoulder.elev": 18,
      "lumbar.flex": 3,
      "thoracic.flex": 5,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest up and back flat with the bar close to your thighs rather than rounding your lower back.",
      14,
    ),
    checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead."),
    checkJointRange(
      "short-pull",
      "Short pull off the pins",
      "Immediately after the bar lifts off the pins, thrust your hips forward until you are standing fully upright.",
      "hip_L.flex",
      28,
    ),
    checkJointWithinAt(
      "above-knee",
      "Knees stay nearly straight",
      "Shins should essentially remain vertical, with only a mild knee bend to reach a bar just above the knees.",
      "knee_L.flex",
      "bottom",
      8,
      32,
    ),
    checkJointWithinAt(
      "hip-dominant",
      "Most of the motion is the hips",
      "More motion should come from your hips than your knees as you descend to the pins.",
      "hip_L.flex",
      "bottom",
      40,
      85,
    ),
  ],
});
