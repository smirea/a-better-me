import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Plate hugged to the chest while the hips, not the spine, do the work. */
const ARMS = {
  "shoulder.elev": 24,
  "shoulder.plane": 72,
  "shoulder.twist": 6,
  "elbow.flex": 100,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "weighted-glute-ham-developer-hip-hinge",
  catalogId: "1a35c6f170d8809696b9f49a464504b0",
  name: "Weighted Glute Ham Developer Hip Hinge",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Hinge", "Stretch", "Raise", "Aligned"],
  tempo: { lower: 2.2, bottom: 0.3, raise: 1.7, top: 0.45 },
  station: { kind: "ghd", padY: 0.96 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  extraGoals: (body) => [pin(body, "pelvisFront", () => new Vector3(0, 0.96, 0.06), 70)],
  stiffness: { lumbar: 8, thoracic: 7, knee: 8, ankle: 8 },
  hints: {
    start: {
      "root.y": 1.02,
      "root.z": 0.12,
      "root.pitch": 78,
      "hip.flex": 12,
      "hip.abd": 6,
      "knee.flex": 8,
      "ankle.dorsi": -4,
      "lumbar.flex": 0,
      "thoracic.flex": 2,
      "neck.flex": 0,
      ...ARMS,
    },
    end: {
      "root.y": 0.72,
      "root.z": 0.28,
      "root.pitch": 98,
      "hip.flex": 58,
      "hip.abd": 4,
      "knee.flex": 10,
      "ankle.dorsi": -2,
      "lumbar.flex": 4,
      "thoracic.flex": 6,
      "neck.flex": 4,
      ...ARMS,
      "shoulder.elev": 40,
    },
  },
  checks: () => [
    checkFlatBack(
      "Hinge at the hips and keep the trunk near neutral, with the lower back flat or only mildly arched.",
      14,
    ),
    checkNeutralNeck(
      "Keep your lower back and neck near a neutral position, like when you are standing upright and looking straight ahead.",
    ),
    checkJointRange(
      "hip-hinge",
      "Torso rotates about the hips",
      "Move the torso as one unit about the hips, then finish aligned with the legs by squeezing the glutes.",
      "hip_L.flex",
      12,
    ),
    checkJointWithinAt(
      "straight-knees",
      "Knees stay nearly straight",
      "Keep the knees straight without locking them by squeezing the quads.",
      "knee_L.flex",
      "bottom",
      -6,
      24,
    ),
    checkJointWithinAt(
      "aligned-top",
      "Torso lines up with the legs",
      "At the top, draw a straight line from your legs through your hips to your shoulders.",
      "hip_L.flex",
      "start",
      0,
      48,
    ),
  ],
});
