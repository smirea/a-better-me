import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pins sit a little below the knee; the bar center rests on that pin. */
const PIN_Y = 0.42;

const ARMS = {
  "shoulder.plane": 78,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "below-the-knee-rack-pull",
  catalogId: "2335c6f170d88028a033dcf3bd00abe9",
  name: "Below-The-Knee Rack Pull",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pins", "Stand", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.85, raise: 1.3, top: 0.45 },
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
    path: { startY: 0.78, startZ: 0.14, endY: PIN_Y + 0.02, endZ: 0.22, arcBulgeZ: 0.04 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "hip.abd": 4, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.82,
      "root.z": -0.06,
      "root.pitch": 48,
      "hip.flex": 72,
      "hip.abd": 4,
      "knee.flex": 36,
      "ankle.dorsi": 8,
      "shoulder.elev": 22,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": -4,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest up and back flat with the bar close to your shins rather than rounding your lower back.",
      16,
    ),
    checkNeutralNeck("Keep your neck near a neutral position while your chest stays up."),
    checkJointRange(
      "hip-drive",
      "Hips extend off the pins",
      "Drive through your legs to begin lifting the bar before thrusting your hips forward to stand upright.",
      "hip_L.flex",
      40,
    ),
    checkJointWithinAt(
      "below-knee",
      "Start just below the knee",
      "Position the safety pins a little below the height of your knees when standing upright.",
      "knee_L.flex",
      "bottom",
      18,
      55,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Your arms should be directed straight down, such that they form approximately 90-degree angles with the bar.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
  ],
});
