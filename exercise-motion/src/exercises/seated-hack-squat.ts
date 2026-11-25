import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Hips stay on the seat. The sled travels on a shallow rail while the back stays on the rest. */
const TRUNK = {
  "root.y": 0.52,
  "root.z": -0.12,
  "root.pitch": -42,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip.abd": 10,
  "hip.rot": 4,
  "clavicle.elev": 2,
  "shoulder.elev": 18,
  "shoulder.plane": 10,
  "elbow.flex": 64,
  "forearm.pron": 22,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "seated-hack-squat",
  catalogId: "2fe5c6f170d88053bd4dd1f084745107",
  name: "Seated Hack Squat",
  defaultLoadKg: 35,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Deep", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 28, stanceX: 0.14 },
  apparatus: { kind: "leg-press-sled", angleDeg: 28, anchor: "ball" },
  stiffness: { knee: 1.1, hip: 1.2, lumbar: 6 },
  hints: {
    start: { ...TRUNK, "hip.flex": 55, "knee.flex": 12, "ankle.dorsi": 8 },
    end: { ...TRUNK, "hip.flex": 98, "knee.flex": 112, "ankle.dorsi": 18 },
  },
  checks: () => [
    checkFlatBack(
      "Keep the buttocks on the seat and the lower back flat on the backrest. Stop before the hip bones curl off the pad.",
    ),
    checkNeutralNeck("Keep the back and neck near neutral, as when standing and looking straight ahead."),
    checkJointWithinAt(
      "lockout",
      "Knees straighten to unrack",
      "Push away from the platform until the knees are straight or just slightly bent and the sled is off the stops.",
      "knee_L.flex",
      "top",
      2,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Sled lowers to a deep knee bend",
      "Lower until the knees are bent by at least 90 degrees, heels down and back still on the rest.",
      "knee_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointRange(
      "knee-rom",
      "Seated hack squat range",
      "Bend and extend the knees and hips together while the hips stay supported on the seat.",
      "knee_L.flex",
      70,
    ),
    checkJointRange(
      "hip-rom",
      "Hips extend against the sled",
      "Drive the feet evenly into the platform so the hips extend with the knees.",
      "hip_L.flex",
      28,
    ),
  ],
});
