import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pins at mid-shin. The bar center sits on the pin, well above a floor pull. */
const PIN_Y = 0.32;

const ARMS = {
  "shoulder.plane": 74,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 76,
  "wrist.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "mid-shin-rack-pull",
  catalogId: "1a35c6f170d880fd8a71e340d039d10a",
  name: "Mid-Shin Rack Pull",
  defaultLoadKg: 48,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Pins", "Stand", "Lockout"],
  tempo: { lower: 1.7, bottom: 0.85, raise: 1.35, top: 0.45 },
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
    path: { startY: 0.78, startZ: 0.14, endY: PIN_Y + 0.02, endZ: 0.24, arcBulgeZ: 0.06 },
  },
  extraContacts: { bar: { shank_L: 0.03, shank_R: 0.03, thigh_L: 0.03, thigh_R: 0.03 } },
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 10, "hip.abd": 4, "root.z": 0.02 },
    end: {
      ...POSTURE_HINTS.standing,
      ...ARMS,
      "root.y": 0.78,
      "root.z": -0.04,
      "root.pitch": 42,
      "hip.flex": 74,
      "hip.abd": 4,
      "knee.flex": 55,
      "ankle.dorsi": 16,
      "shoulder.elev": 24,
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
      "Hips and knees extend off the pins",
      "Drive through your legs to begin lifting the bar as you push the floor away while extending your hips and knees.",
      "knee_L.flex",
      32,
    ),
    checkJointWithinAt(
      "mid-shin",
      "Deeper knee bend than a below-knee pull",
      "The pins sit at mid-shin, so the knees bend more than a below-the-knee rack pull and less than a floor pull.",
      "knee_L.flex",
      "bottom",
      38,
      85,
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
