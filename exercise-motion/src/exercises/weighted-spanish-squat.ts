import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt, plantBothFeet } from "../postures";
import { lockAngle } from "../solver";

const GOBLET = {
  "clavicle.elev": 6,
  "shoulder.elev": 48,
  "shoulder.plane": 72,
  "shoulder.twist": 18,
  "elbow.flex": 112,
  "forearm.pron": -50,
  "wrist.flex": 8,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip.abd": 10,
  "hip.rot": 6,
  ...GOBLET,
};

export const spec = buildExerciseSpec({
  id: "weighted-spanish-squat",
  catalogId: "2065c6f170d880608004f5452a5f971e",
  name: "Weighted Spanish Squat",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Parallel", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  extraEquipment: [
    box("spanish.post", [0, 0.72, 0.95], [0.1, 1.45, 0.08], "steel", false),
    box("spanish.strap", [0, 0.48, 0.5], [0.36, 0.035, 0.86], "band", false),
  ],
  ground: "heel_L",
  extraGoals: (body) => [
    ...plantBothFeet(body, 0.16, 0.02, 0.1, 0),
    lockAngle(body, "lumbar.flex", 4, 16),
    lockAngle(body, "ankle_L.dorsi", 10, 5),
    lockAngle(body, "ankle_R.dorsi", 10, 5),
    lockAngle(body, "elbow_L.flex", 112, 16),
    lockAngle(body, "elbow_R.flex", 112, 16),
  ],
  stiffness: { lumbar: 8, ankle: 6, knee: 1.2, hip: 1.1 },
  hints: {
    start: { ...TRUNK, "hip.flex": 6, "knee.flex": 6, "ankle.dorsi": 4 },
    end: {
      ...TRUNK,
      "root.y": 0.58,
      "root.z": -0.04,
      "root.pitch": 4,
      "hip.flex": 90,
      "knee.flex": 92,
      "ankle.dorsi": 8,
    },
  },
  // Band sits just below the knees and runs forward to the rack post, keeping the shins upright.
  checks: () => [
    checkFeetPlanted("Keep the soles of the feet fully on the ground."),
    checkJointWithinAt(
      "upright",
      "Starts standing tall",
      "Stand fully upright facing the anchor, band across the top of the calves, weight at the chest.",
      "knee_L.flex",
      "start",
      0,
      18,
    ),
    checkJointWithinAt(
      "thighs-parallel",
      "Thighs reach about parallel",
      "Squat until the thighs are about parallel, with the torso and lower legs staying vertical.",
      "knee_L.flex",
      "peak",
      75,
      115,
    ),
    checkJointWithinAt(
      "shins-up",
      "Lower legs stay nearly vertical",
      "The band holds the shins upright, so the ankles do not bend much as the hips drop.",
      "ankle_L.dorsi",
      "peak",
      -4,
      20,
    ),
    checkJointRange(
      "knee-rom",
      "Knees bend and straighten",
      "Bend the knees and hips to squat down, then press the ground away to stand.",
      "knee_L.flex",
      60,
    ),
    checkJointWithinAt(
      "goblet",
      "Weight stays at the chest",
      "Hold the weight right next to the chest with the elbows bent.",
      "elbow_L.flex",
      "peak",
      85,
      140,
    ),
  ],
});
