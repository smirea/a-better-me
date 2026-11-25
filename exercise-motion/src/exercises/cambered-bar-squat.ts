import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Cambered squat bar: the shaft bows forward so the plates hang in front of the shoulders.
 * `style: "cambered"` is accepted by the apparatus type but still draws a straight Olympic shaft.
 */
const ARMS = {
  "clavicle.prot": -12,
  "clavicle.elev": 8,
  "shoulder.elev": 40,
  "shoulder.plane": -24,
  "shoulder.twist": -58,
  "elbow.flex": 128,
  "forearm.pron": 50,
  "wrist.flex": -16,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 12,
  "knee.flex": 8,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.54,
  "root.z": -0.04,
  "root.pitch": 18,
  "hip.flex": 108,
  "hip.abd": 16,
  "hip.rot": 8,
  "knee.flex": 116,
  "ankle.dorsi": 24,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "cambered-bar-squat",
  catalogId: "3005c6f170d880eeb433c795c4f8cc5d",
  name: "Cambered Bar Squat",
  defaultLoadKg: 50,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 2.4, bottom: 0.35, raise: 1.6, top: 0.7 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 16, trackKnees: 12, rack: { hookY: 1.4, safetyY: 0.6 } },
  apparatus: { kind: "barbell", style: "cambered", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips, but avoid letting your lower back round or chest cave down.",
      16,
    ),
    checkNeutralNeck(
      "Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
    ),
    checkFeetPlanted(
      "Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet.",
    ),
    checkJointRange(
      "controlled-depth",
      "Descend only after the bar is still",
      "Once the bar is motionless, squat down through the range your mobility allows. Descend a bit slower than a straight-bar squat so the camber does not swing.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "high-bar-shelf",
      "Bar stays on the upper-back shelf",
      "Keep the bar snugly on the muscular shelf of the traps, above the rear delts, with the shoulder blades pulled back and the chest up.",
      "shoulder_L.elev",
      "bottom",
      20,
      70,
    ),
    checkJointWithinAt(
      "no-hip-shoot",
      "Hips finish extended",
      "Avoid letting your hips shoot back excessively, which could prompt the bar to swing and pitch your torso forward. Finish with the hips extended.",
      "hip_L.flex",
      "top",
      0,
      20,
    ),
  ],
});
