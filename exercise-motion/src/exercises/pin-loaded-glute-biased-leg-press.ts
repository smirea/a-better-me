import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const SEATED = {
  "root.y": 0.5,
  "root.z": -0.06,
  "root.pitch": -44,
  "hip.abd": 14,
  "hip.rot": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "clavicle.elev": 4,
  "shoulder.elev": 20,
  "shoulder.plane": -8,
  "elbow.flex": 68,
  "forearm.pron": 16,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "pin-loaded-glute-biased-leg-press",
  catalogId: "2aa5c6f170d880609d4cccdf89ec7b9e",
  name: "Pin-Loaded Glute-Biased Leg Press",
  defaultLoadKg: 28,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2.1, bottom: 0.4, raise: 1.5, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 15, stanceX: 0.2 },
  apparatus: { kind: "leg-press-sled", angleDeg: 15, anchor: "ball" },
  stiffness: { knee: 2.6, hip: 2.8, ankle: 2.4 },
  hints: {
    start: { ...SEATED, "hip.flex": 66, "knee.flex": 14, "ankle.dorsi": 4 },
    end: { ...SEATED, "hip.flex": 106, "knee.flex": 92, "ankle.dorsi": 6 },
  },
  checks: () => [
    checkFlatBack("Keep the lower back flat. Move the seat back if the hips start to round at the bottom."),
    checkNeutralNeck("Keep the neck near neutral on or just off the backrest."),
    checkJointWithinAt(
      "hips-deep",
      "Hips bend deeply",
      "Feet sit on the upper half of the platform, mildly outside shoulder width, so the hips bend more than the knees.",
      "hip_L.flex",
      "peak",
      88,
      122,
    ),
    checkJointWithinAt(
      "shins-up",
      "Shins stay relatively upright",
      "Emphasize pushing through the heels while the whole sole stays on the platform.",
      "ankle_L.dorsi",
      "peak",
      -8,
      14,
    ),
    checkJointRange(
      "hip-rom",
      "Hip extension drives the press",
      "Straighten the hips and knees together to push the platform away.",
      "hip_L.flex",
      28,
    ),
  ],
});
