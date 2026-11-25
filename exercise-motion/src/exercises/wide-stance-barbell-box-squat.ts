import { platformBox } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const ARMS = {
  "clavicle.prot": -16,
  "clavicle.elev": 6,
  "shoulder.elev": 34,
  "shoulder.plane": -28,
  "shoulder.twist": -64,
  "elbow.flex": 132,
  "forearm.pron": 56,
  "wrist.flex": -20,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.abd": 16,
  "hip.rot": 22,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.62,
  "root.z": -0.12,
  "root.pitch": 32,
  "hip.flex": 92,
  "hip.abd": 24,
  "hip.rot": 12,
  "knee.flex": 96,
  "ankle.dorsi": 16,
  "ankle.inv": 2,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "wide-stance-barbell-box-squat",
  catalogId: "29f5c6f170d880e8b9ffd076b4e4abbb",
  name: "Wide Stance Barbell Box Squat",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Sit", "Stand", "Top"],
  tempo: { lower: 2, bottom: 1, raise: 1.5, top: 0.6 },
  station: {
    kind: "standing",
    stanceX: 0.32,
    toeOutDeg: 38,
    trackKnees: 14,
    rack: { hookY: 1.38, safetyY: 0.72 },
  },
  apparatus: { kind: "barbell", gripX: 0.46, anchor: "press", restAnchor: "traps" },
  extraEquipment: platformBox("squat.box", [0, 0, -0.28], 0.7, 0.48, 0.36, "wood"),
  extraContacts: { "squat.box": { pelvis: 0.06, thigh_L: 0.05, thigh_R: 0.05, foot_L: 0.02, foot_R: 0.02 } },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack(
      "Let your torso naturally lean forward at your hips to maintain your balance, but avoid letting your lower back round or chest cave down.",
      18,
    ),
    checkNeutralNeck("The soles of your feet should be fully planted, while your lower back is flat and your head is looking straight ahead."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground as your weight is evenly distributed throughout your feet."),
    checkJointRange(
      "knee-depth",
      "Sit to the box in a wide stance",
      "Continue to squat down until you can sit onto the box in a controlled manner, as you avoid plopping onto the box.",
      "knee_L.flex",
      65,
    ),
    checkJointWithinAt(
      "wide-hips",
      "Feet stay clearly outside shoulder width",
      "Position your feet clearly outside shoulder width, and point your toes moderately out to the sides. A stance at least about 150% of shoulder width is an appropriate starting point.",
      "hip_L.abd",
      "bottom",
      12,
      40,
    ),
    checkJointWithinAt(
      "pause",
      "Pause on the box",
      "While keeping your core braced and back flat, allow about half of your weight to deload into the box as you pause on the box for approximately one second.",
      "hip_L.flex",
      "peak",
      75,
      120,
    ),
  ],
});
