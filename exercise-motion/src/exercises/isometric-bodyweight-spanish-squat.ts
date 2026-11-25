import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFeetPlanted, checkJointWithinAt, plantBothFeet } from "../postures";
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

const HOLD = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.58,
  "root.z": -0.04,
  "root.pitch": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip.flex": 90,
  "hip.abd": 10,
  "hip.rot": 6,
  "knee.flex": 92,
  "ankle.dorsi": 8,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "isometric-bodyweight-spanish-squat",
  catalogId: "2065c6f170d880a2b2f0f0bcec8f1376",
  name: "Isometric Bodyweight Spanish Squat",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  isometric: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Hold", "Hold", "Hold"],
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
  stiffness: { lumbar: 8, ankle: 6, knee: 6, hip: 5 },
  hints: { start: HOLD, end: HOLD },
  checks: () => [
    checkFeetPlanted("Keep the soles of the feet fully on the ground."),
    checkJointWithinAt(
      "thighs-parallel",
      "Thighs hold about parallel",
      "Hold the squat with the thighs about parallel and the torso vertical.",
      "knee_L.flex",
      "start",
      75,
      115,
    ),
    checkJointWithinAt(
      "shins-up",
      "Lower legs stay nearly vertical",
      "Keep the shins vertical while the band holds the calves.",
      "ankle_L.dorsi",
      "start",
      -4,
      20,
    ),
    checkJointWithinAt(
      "hips-bent",
      "Hips stay bent in the hold",
      "Bend the knees and hips until the thighs are near parallel, then hold.",
      "hip_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "torso-up",
      "Torso stays vertical",
      "Keep the shoulders stacked over the hips for the whole hold.",
      "lumbar.flex",
      "start",
      -8,
      16,
    ),
  ],
});
