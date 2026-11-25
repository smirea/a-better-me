import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Y, cylinder } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "clavicle.prot": -14,
  "clavicle.elev": 6,
  "shoulder.elev": 36,
  "shoulder.plane": -32,
  "shoulder.twist": -68,
  "elbow.flex": 136,
  "forearm.pron": 58,
  "wrist.flex": -22,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 6,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.52,
  "root.z": -0.08,
  "root.pitch": 26,
  "hip.flex": 112,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 120,
  "ankle.dorsi": 24,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
};

/** Visual band pegs. The builder cannot hang live bands off a barbell in the same apparatus. */
const BANDS = [
  cylinder("band.pegL", [0.72, 0.08, 0.02], 0.02, 0.16, "steel", ALONG_Y, false),
  cylinder("band.pegR", [-0.72, 0.08, 0.02], 0.02, 0.16, "steel", ALONG_Y, false),
  cylinder("band.loopL", [0.62, 0.78, 0.02], 0.012, 1.35, "band", ALONG_Y, false),
  cylinder("band.loopR", [-0.62, 0.78, 0.02], 0.012, 1.35, "band", ALONG_Y, false),
];

export const spec = buildExerciseSpec({
  id: "banded-barbell-back-squat",
  catalogId: "1a25c6f170d880d0b665c0079cfecf80",
  name: "Banded Barbell Back Squat",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 2.2, bottom: 0.15, raise: 1.3, top: 0.45 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 18, trackKnees: 12, rack: { hookY: 1.4, safetyY: 0.58 } },
  apparatus: { kind: "barbell", gripX: 0.42, anchor: "press", restAnchor: "traps" },
  extraEquipment: BANDS,
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips to maintain your balance, but avoid letting your lower back round or chest cave down.",
      16,
    ),
    checkNeutralNeck(
      "Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
    ),
    checkFeetPlanted(
      "Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet.",
    ),
    checkJointRange(
      "full-depth",
      "Squat through the available range",
      "Continue to squat down through the full range of motion your mobility allows without rounding your back or lifting your heels.",
      "knee_L.flex",
      75,
    ),
    checkJointWithinAt(
      "band-lockout",
      "Stand into rising band tension",
      "As you lift the bar higher, the band tension progressively increases until the knees and hips are straight.",
      "knee_L.flex",
      "top",
      0,
      16,
    ),
    checkJointWithinAt(
      "bar-on-back",
      "Hands keep the bar on the upper back",
      "Pull down on the bar to keep it positioned on your upper back, and maintain this bar position throughout your set.",
      "elbow_L.flex",
      "bottom",
      100,
      155,
    ),
  ],
});
