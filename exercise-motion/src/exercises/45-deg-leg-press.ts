import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Reclined into the 45° backrest, hands on the side handles, feet mid-plate. */
const SEATED = {
  "root.y": 0.5,
  "root.z": -0.06,
  "root.pitch": -46,
  "hip.abd": 12,
  "hip.rot": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "clavicle.elev": 4,
  "shoulder.elev": 22,
  "shoulder.plane": -10,
  "shoulder.twist": 8,
  "elbow.flex": 72,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "45-deg-leg-press",
  catalogId: "1a25c6f170d88079a926dde776766181",
  name: "45° Leg Press",
  defaultLoadKg: 18,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 45, stanceX: 0.16 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  stiffness: { knee: 3.2, hip: 2.2, ankle: 1.6 },
  hints: {
    start: { ...SEATED, "hip.flex": 62, "knee.flex": 10, "ankle.dorsi": 4 },
    end: { ...SEATED, "hip.flex": 102, "knee.flex": 108, "ankle.dorsi": 16 },
  },
  checks: () => [
    checkFlatBack("Keep your buttocks on the seat and your lower back flat against the backrest."),
    checkNeutralNeck("Keep your neck near a neutral position, as when you look straight ahead while standing."),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Finish with the knees straight or only slightly bent. Do not snap them into a hard lockout.",
      "knee_L.flex",
      "start",
      2,
      22,
    ),
    checkJointWithinAt(
      "depth",
      "Knees bend through a full press",
      "Lower the sled until the knees are bent by at least about 90 degrees, while the heels stay on the platform.",
      "knee_L.flex",
      "peak",
      90,
      125,
    ),
    checkJointRange(
      "knee-rom",
      "Knees and hips press the sled",
      "Bend and straighten the knees and hips together to lower and drive the sled.",
      "knee_L.flex",
      75,
    ),
    checkJointRange(
      "hip-rom",
      "Hips travel with the knees",
      "Let the hips bend as the sled comes toward you, then extend them as you press it away.",
      "hip_L.flex",
      28,
    ),
  ],
});
