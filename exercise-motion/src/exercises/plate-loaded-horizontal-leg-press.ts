import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Reclined on the fixed leg-press backrest, pressing a near-horizontal sled. */
const TRUNK = {
  "root.y": 0.5,
  "root.z": -0.16,
  "root.pitch": -50,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "hip.abd": 10,
  "hip.rot": 6,
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 6,
  "shoulder.twist": 8,
  "elbow.flex": 70,
  "forearm.pron": 24,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "plate-loaded-horizontal-leg-press",
  catalogId: "3635c6f170d88026ad4aefea015a87a6",
  name: "Plate-Loaded Horizontal Leg Press",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Deep", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 15, stanceX: 0.14 },
  apparatus: { kind: "leg-press-sled", angleDeg: 15, anchor: "ball" },
  stiffness: { knee: 1.2, hip: 1.1, ankle: 0.8, lumbar: 6 },
  hints: {
    start: { ...TRUNK, "hip.flex": 48, "knee.flex": 10, "ankle.dorsi": 6 },
    end: { ...TRUNK, "hip.flex": 102, "knee.flex": 108, "ankle.dorsi": 16 },
  },
  checks: () => [
    checkFlatBack(
      "With the seat close enough for a full press, keep the lower back near its natural curve against the backrest instead of rounding.",
    ),
    checkNeutralNeck("Keep the neck near neutral, as when looking straight ahead while standing."),
    checkJointWithinAt(
      "knees-soft-lock",
      "Knees straighten without a snap",
      "Finish with the knees fully straightened or ever so slightly bent. Avoid snapping them into a hard lockout.",
      "knee_L.flex",
      "top",
      2,
      42,
    ),
    checkJointWithinAt(
      "deep-knees",
      "Knees bend through a full press",
      "Bring the footplate back until the knees are bent about 90 degrees or more, without the heels lifting or the low back rounding.",
      "knee_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointRange(
      "knee-rom",
      "Knee extension drives the sled",
      "Drive the feet into the footplate to push it away as the knees and hips extend together.",
      "knee_L.flex",
      70,
    ),
    checkJointRange(
      "hip-rom",
      "Hips extend with the press",
      "Extend the hips together with the knees, keeping the buttocks on the seat and the back on the backrest.",
      "hip_L.flex",
      35,
    ),
  ],
});
