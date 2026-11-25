import { platformBox } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** High bar: bar on the traps, elbows more under the bar, torso more upright than a low-bar box squat. */
const ARMS = {
  "clavicle.prot": -8,
  "clavicle.elev": 10,
  "shoulder.elev": 48,
  "shoulder.plane": -18,
  "shoulder.twist": -48,
  "elbow.flex": 118,
  "forearm.pron": 42,
  "wrist.flex": -12,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.abd": 8,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.56,
  "root.z": -0.04,
  "root.pitch": 16,
  "hip.flex": 108,
  "hip.abd": 14,
  "hip.rot": 8,
  "knee.flex": 114,
  "ankle.dorsi": 26,
  "lumbar.flex": 4,
  "thoracic.flex": 4,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "high-bar-box-squat",
  catalogId: "29f5c6f170d8803b9bd7da5e16e2e6cc",
  name: "High Bar Box Squat",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Sit", "Stand", "Top"],
  tempo: { lower: 2, bottom: 1, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.18, toeOutDeg: 16, trackKnees: 14, rack: { hookY: 1.42, safetyY: 0.62 } },
  apparatus: { kind: "barbell", gripX: 0.34, anchor: "press", restAnchor: "traps" },
  extraEquipment: platformBox("squat.box", [0, 0, -0.26], 0.46, 0.46, 0.32, "wood"),
  extraContacts: { "squat.box": { pelvis: 0.06, thigh_L: 0.04, thigh_R: 0.04 } },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips, but avoid letting your lower back round or chest cave down.",
      14,
    ),
    checkNeutralNeck(
      "Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
    ),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange(
      "sit",
      "Sit onto the box",
      "Continue to squat down until you can sit onto the box in a controlled manner, without plopping or rocking back.",
      "knee_L.flex",
      75,
    ),
    checkJointWithinAt(
      "high-bar",
      "Bar stays on the traps",
      "For this high bar variation, the bar rests on the muscular shelf formed by the traps above the rear delts and above the scapular spine.",
      "shoulder_L.elev",
      "bottom",
      28,
      75,
    ),
    checkJointWithinAt(
      "upright-on-box",
      "Torso lean stays modest on the box",
      "As you sit on the box, your torso should maintain the same modest forward lean you had just before reaching the box.",
      "thoracic.flex",
      "bottom",
      -6,
      16,
    ),
  ],
});
