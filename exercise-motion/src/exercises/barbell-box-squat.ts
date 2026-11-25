import { platformBox } from "../equipment";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
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
  "root.pitch": 4,
  "hip.abd": 10,
  "hip.rot": 14,
  "knee.flex": 6,
  "ankle.dorsi": 3,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.58,
  "root.z": -0.1,
  "root.pitch": 28,
  "hip.flex": 98,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 100,
  "ankle.dorsi": 18,
  "ankle.inv": 2,
  "lumbar.flex": 6,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "barbell-box-squat",
  catalogId: "1a25c6f170d880f6a715f65d5e8b425b",
  name: "Barbell Box Squat",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Sit", "Stand", "Top"],
  tempo: { lower: 2, bottom: 1, raise: 1.5, top: 0.6 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  extraEquipment: platformBox("squat.box", [0, 0, -0.3], 0.46, 0.5, 0.32, "wood"),
  extraContacts: { "squat.box": { pelvis: 0.06, thigh_L: 0.04, thigh_R: 0.04, foot_L: 0.02, foot_R: 0.02 } },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack("Let your torso naturally lean forward at your hips, but avoid letting your lower back round or chest cave down.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Sit to the box", "Continue to squat down until you can sit onto the box in a controlled manner.", "knee_L.flex", 70),
    checkJointWithinAt("sit", "Paused on the box", "Allow about half of your weight to deload into the box as you pause on the box for approximately one second.", "hip_L.flex", "peak", 80, 120),
    checkJointWithinAt("chest-up", "Chest stays up on the box", "As you sit on the box, avoid rocking the torso forward to a more hinged position.", "thoracic.flex", "peak", -15, 20),
  ],
});
