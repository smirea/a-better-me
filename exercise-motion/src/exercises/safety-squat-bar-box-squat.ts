import { platformBox } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Palms face each other on the handles angled down in front of the torso. */
const ARMS = {
  "clavicle.prot": 8,
  "shoulder.elev": 46,
  "shoulder.plane": 48,
  "shoulder.twist": 24,
  "elbow.flex": 96,
  "forearm.pron": -16,
  "wrist.flex": 12,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 12,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.58,
  "root.z": -0.08,
  "root.pitch": 22,
  "hip.flex": 100,
  "hip.abd": 16,
  "hip.rot": 8,
  "knee.flex": 104,
  "ankle.dorsi": 20,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "safety-squat-bar-box-squat",
  catalogId: "39c5c6f170d88040ab7be5efdac6895c",
  name: "Safety Squat Bar Box Squat",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Sit", "Stand", "Top"],
  tempo: { lower: 2, bottom: 1, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.2, toeOutDeg: 18, trackKnees: 12, rack: { hookY: 1.46, safetyY: 0.68 } },
  apparatus: {
    kind: "barbell",
    style: "ssb",
    restAnchor: "traps",
    gripX: 0.16,
    skipHandRequired: true,
    anchor: "press",
  },
  extraEquipment: platformBox("squat.box", [0, 0, -0.28], 0.5, 0.48, 0.34, "wood"),
  extraContacts: {
    "squat.box": { pelvis: 0.06, thigh_L: 0.04, thigh_R: 0.04 },
    bar: { neck: 0.03, girdle: 0.05, chest: 0.03, upperarm_L: 0.05, upperarm_R: 0.05, hand_L: 0.06, hand_R: 0.06 },
  },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips, but avoid letting your lower back round or chest cave down.",
      16,
    ),
    checkNeutralNeck(
      "Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
    ),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange(
      "sit",
      "Sit onto the box",
      "Continue to squat down until you can sit onto the box in a controlled manner, as you avoid plopping onto the box or rocking back onto the box.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "handles",
      "Hands stay on the SSB handles",
      "Your palms should be facing in toward each other while grasping the handles with bent elbows, and you keep holding them throughout the set.",
      "elbow_L.flex",
      "bottom",
      70,
      130,
    ),
    checkJointWithinAt(
      "pause",
      "Pause on the box",
      "While keeping your core braced and back flat, and feet fully on the ground, allow about half of your weight to deload into the box as you pause for about one second.",
      "hip_L.flex",
      "peak",
      80,
      125,
    ),
  ],
});
