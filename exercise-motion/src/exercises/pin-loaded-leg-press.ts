import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Seated horizontal / pin-loaded press: sled runs nearly level, feet mid-plate. */
const SEATED = {
  "root.y": 0.5,
  "root.z": -0.04,
  "root.pitch": -44,
  "hip.abd": 12,
  "hip.rot": 8,
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
  id: "pin-loaded-leg-press",
  catalogId: "1a25c6f170d8802ea9b9ce71cd9d3d67",
  name: "Pin-Loaded Leg Press",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 15, stanceX: 0.16 },
  apparatus: { kind: "leg-press-sled", angleDeg: 15, anchor: "ball" },
  stiffness: { knee: 3.2, hip: 2.2, ankle: 1.6 },
  hints: {
    start: { ...SEATED, "hip.flex": 64, "knee.flex": 12, "ankle.dorsi": 6 },
    end: { ...SEATED, "hip.flex": 100, "knee.flex": 104, "ankle.dorsi": 14 },
  },
  checks: () => [
    checkFlatBack("Keep the lower back close to its natural curve against the backrest."),
    checkNeutralNeck("Rest the head on the pad or just off it, with the neck near neutral."),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Press until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      4,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Seat is set for a full bend",
      "Return until the knees are bent near 90 degrees or more, with the heels still on the platform.",
      "knee_L.flex",
      "peak",
      85,
      120,
    ),
    checkJointRange(
      "knee-rom",
      "Knees drive the horizontal sled",
      "Straighten the knees to push the platform away, then bend them back to the start.",
      "knee_L.flex",
      70,
    ),
  ],
});
