import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { ALONG_Y, box, cylinder } from "../equipment";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Standing between a shrug machine's handles, facing away from the stack, squatting the handles up. */
const ARMS = {
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 36,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 4,
  "hip.flex": 8,
  "hip.abd": 8,
  "hip.rot": 6,
  "knee.flex": 8,
  "ankle.dorsi": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "shrug-machine-squat",
  catalogId: "36d5c6f170d880328a62e32cef125c41",
  name: "Shrug Machine Squat",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  tempo: { lower: 1.7, bottom: 0.2, raise: 1.3, top: 0.4 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 12, trackKnees: 12, heelZ: 0.04 },
  apparatus: { kind: "dumbbells", anchor: "grip" },
  extraEquipment: [
    box("shrug.base", [0, 0.04, -0.45], [0.9, 0.08, 0.7], "steel", false),
    box("shrug.stack", [0, 0.7, -0.7], [0.32, 1.2, 0.22], "plate", false),
    cylinder("shrug.postL", [0.42, 0.7, -0.15], 0.035, 1.3, "steel", ALONG_Y, false),
    cylinder("shrug.postR", [-0.42, 0.7, -0.15], 0.035, 1.3, "steel", ALONG_Y, false),
  ],
  stiffness: { lumbar: 6, elbow: 3, shoulder: 1.2, knee: 0.7, hip: 0.65 },
  hints: {
    start: { ...UP, "root.y": 0.94 },
    end: {
      ...UP,
      "root.y": 0.58,
      "root.z": -0.06,
      "root.pitch": 28,
      "hip.flex": 95,
      "hip.abd": 14,
      "knee.flex": 108,
      "ankle.dorsi": 22,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep the chest up and the back flat. Let the torso lean at the hips, and do not round the lower back to reach the handles.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral while the arms stay long on the handles."),
    checkFeetPlanted("Keep the soles planted and the knees lined up over the toes."),
    checkJointWithinAt(
      "arms-straight",
      "Elbows stay straight on the handles",
      "Grasp the handles with straight elbows and lift them with the legs, not by curling.",
      "elbow_L.flex",
      "bottom",
      0,
      24,
    ),
    checkJointRange(
      "knee-rom",
      "Squat the handles up",
      "Sit the hips back and down until the knees are deeply bent, then drive the floor away to stand tall.",
      "knee_L.flex",
      70,
    ),
    checkJointRange(
      "hip-rom",
      "Hips extend to stand",
      "Stand so a side view shows the legs, hips, and shoulders stacked, without leaning back.",
      "hip_L.flex",
      55,
    ),
  ],
});
