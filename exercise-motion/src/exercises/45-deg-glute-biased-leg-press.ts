import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Feet high and wide: deeper hip flexion, more vertical shins, less ankle bend. */
const SEATED = {
  "root.y": 0.5,
  "root.z": -0.08,
  "root.pitch": -46,
  "hip.abd": 14,
  "hip.rot": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "clavicle.elev": 4,
  "shoulder.elev": 22,
  "shoulder.plane": -10,
  "elbow.flex": 72,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "45-deg-glute-biased-leg-press",
  catalogId: "2aa5c6f170d880c08fcbf27e03a0e2dc",
  name: "45° Glute-Biased Leg Press",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2.1, bottom: 0.35, raise: 1.5, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 45, stanceX: 0.2 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  stiffness: { knee: 2.6, hip: 2.8, ankle: 2.4 },
  hints: {
    start: { ...SEATED, "hip.flex": 64, "knee.flex": 12, "ankle.dorsi": 2 },
    end: { ...SEATED, "hip.flex": 108, "knee.flex": 96, "ankle.dorsi": 6 },
  },
  checks: () => [
    checkFlatBack(
      "Stop before the buttocks curl off the seat. High foot placement makes the lower back round sooner.",
      12,
    ),
    checkNeutralNeck("Keep the neck near neutral against or just off the backrest."),
    checkJointWithinAt(
      "hips-deep",
      "Hips reach a deep bend",
      "With the feet high on the platform, let the hips bend deeply while the shins stay closer to vertical.",
      "hip_L.flex",
      "peak",
      90,
      125,
    ),
    checkJointWithinAt(
      "shins-up",
      "Shins stay relatively upright",
      "A high foot placement keeps the ankles from folding. Push through the heels with the whole sole down.",
      "ankle_L.dorsi",
      "peak",
      -8,
      14,
    ),
    checkJointRange(
      "hip-rom",
      "Hips lead the glute-biased press",
      "Lower and press by bending and extending the hips, with the knees sharing the motion.",
      "hip_L.flex",
      24,
    ),
    checkJointWithinAt(
      "knees-soft",
      "Knees stay softer than a low-foot press",
      "High feet keep the knees from folding as deeply as a quad-biased setup. They finish only slightly bent.",
      "knee_L.flex",
      "start",
      8,
      52,
    ),
  ],
});
