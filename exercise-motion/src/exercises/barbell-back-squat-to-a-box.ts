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
  "root.y": 0.56,
  "root.z": -0.08,
  "root.pitch": 26,
  "hip.flex": 104,
  "hip.abd": 18,
  "hip.rot": 8,
  "knee.flex": 108,
  "ankle.dorsi": 22,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "barbell-back-squat-to-a-box",
  catalogId: "2175c6f170d88016b116fd4b832edc5f",
  name: "Barbell Back Squat To A Box",
  defaultLoadKg: 70,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Tap", "Stand", "Top"],
  tempo: { lower: 1.8, bottom: 0.15, raise: 1.4, top: 0.55 },
  station: { kind: "standing", stanceX: 0.19, toeOutDeg: 20, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: { kind: "barbell", gripX: 0.4, anchor: "press", restAnchor: "traps" },
  extraEquipment: platformBox("squat.box", [0, 0, -0.3], 0.46, 0.5, 0.32, "wood"),
  extraContacts: { "squat.box": { pelvis: 0.05, thigh_L: 0.035, thigh_R: 0.035, foot_L: 0.02, foot_R: 0.02 } },
  hints: { start: STAND, end: BOTTOM },
  checks: () => [
    checkFlatBack("Avoid letting your lower back round or chest cave down.", 16),
    checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
    checkFeetPlanted("Keep the entire sole of each foot firmly planted on the ground."),
    checkJointRange("knee-depth", "Squat to the box", "Continue to squat down until you can lightly contact the box with your buttocks.", "knee_L.flex", 75),
    checkJointWithinAt("tap-depth", "Thighs near parallel at the tap", "Pick a box height near the depth of a full range of motion back squat, with the thighs fairly close to parallel.", "hip_L.flex", "peak", 85, 120),
    checkJointWithinAt("chest-up", "Torso leans only at the hips", "Let your torso naturally lean forward at your hips to maintain your balance.", "hip_L.flex", "peak", 85, 125),
  ],
});
