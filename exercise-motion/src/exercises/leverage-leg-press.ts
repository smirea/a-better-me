import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Plate-loaded leverage / pivot press. The shared sled is linear, so a shallower
 * rail (about 32°) stands in for the swinging footplate of a leverage machine.
 */
const SEATED = {
  "root.y": 0.5,
  "root.z": -0.05,
  "root.pitch": -42,
  "hip.abd": 12,
  "hip.rot": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "clavicle.elev": 4,
  "shoulder.elev": 22,
  "shoulder.plane": -8,
  "elbow.flex": 70,
  "forearm.pron": 16,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "leverage-leg-press",
  catalogId: "3105c6f170d8805a8e91c9ad449c185a",
  name: "Leverage Leg Press",
  defaultLoadKg: 24,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 32, stanceX: 0.16 },
  apparatus: { kind: "leg-press-sled", angleDeg: 32, anchor: "ball" },
  stiffness: { knee: 3.2, hip: 2.2, ankle: 1.6 },
  hints: {
    start: { ...SEATED, "hip.flex": 66, "knee.flex": 12, "ankle.dorsi": 6 },
    end: { ...SEATED, "hip.flex": 104, "knee.flex": 106, "ankle.dorsi": 16 },
  },
  checks: () => [
    checkFlatBack("Keep the buttocks on the seat and the lower back flat on the backrest."),
    checkNeutralNeck("Keep the neck near neutral, head on the pad or just in front of it."),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Drive the foot platform away until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      4,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Knees bend at least 90 degrees",
      "Lower the platform until the knees are bent by at least about 90 degrees, heels down.",
      "knee_L.flex",
      "peak",
      88,
      125,
    ),
    checkJointRange(
      "knee-rom",
      "Knees and hips move the platform",
      "Bend the knees and hips together to lower the platform, then press it away.",
      "knee_L.flex",
      70,
    ),
  ],
});
