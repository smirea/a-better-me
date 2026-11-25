import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt, plantBothFeet } from "../postures";
import { lockAngle } from "../solver";

const ARMS = {
  "clavicle.elev": 2,
  "shoulder.elev": 12,
  "shoulder.plane": 4,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 16,
  "wrist.flex": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip.abd": 10,
  "hip.rot": 6,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-spanish-squat",
  catalogId: "1a25c6f170d880a7b3cdefbf6c09dae4",
  name: "Bodyweight Spanish Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Parallel", "Drive", "Stand"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.6, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  apparatus: { kind: "none" },
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
  checks: () => [
    checkFeetPlanted("Keep the soles of the feet fully on the ground."),
    checkJointWithinAt(
      "upright",
      "Starts standing tall",
      "Stand fully upright facing the anchor, band across the top of the calves.",
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
      "torso-up",
      "Shoulders stay stacked over the hips",
      "Keep the torso vertical and resist any forward lean.",
      "lumbar.flex",
      "peak",
      -8,
      16,
    ),
  ],
});
