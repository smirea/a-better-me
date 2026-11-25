import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Feet low on the plate: deeper knee flexion and more ankle dorsiflexion, less hip bend. */
const SEATED = {
  "root.y": 0.5,
  "root.z": -0.02,
  "root.pitch": -46,
  "hip.abd": 10,
  "hip.rot": 6,
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
  id: "45-deg-quad-biased-leg-press",
  catalogId: "2aa5c6f170d880b9ac35f31351088d34",
  name: "45° Quad-Biased Leg Press",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2.1, bottom: 0.3, raise: 1.5, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 45, stanceX: 0.13 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  extraContacts: { sled: { shank_L: 0.08, shank_R: 0.08, foot_L: 0.05, foot_R: 0.05 } },
  stiffness: { knee: 3.6, hip: 1.8, ankle: 1.2 },
  hints: {
    start: { ...SEATED, "hip.flex": 48, "knee.flex": 16, "ankle.dorsi": 12 },
    end: { ...SEATED, "hip.flex": 72, "knee.flex": 108, "ankle.dorsi": 20 },
  },
  checks: () => [
    checkFlatBack("Keep the lower back flat on the backrest and the heels fully on the low part of the platform."),
    checkNeutralNeck("Keep the neck near neutral."),
    checkJointWithinAt(
      "deep-knees",
      "Knees bend deeply",
      "With the feet low on the platform, lower until the knees are bent well past 90 degrees.",
      "knee_L.flex",
      "peak",
      95,
      130,
    ),
    checkJointWithinAt(
      "ankles-fold",
      "Knees travel over the toes",
      "Low foot placement asks the ankles to dorsiflex so the knees can travel forward over the feet.",
      "ankle_L.dorsi",
      "peak",
      10,
      36,
    ),
    checkJointRange(
      "knee-rom",
      "Quad-biased knee travel",
      "Most of the range is at the knees. Press evenly through the whole foot.",
      "knee_L.flex",
      85,
    ),
    checkJointWithinAt(
      "knees-straight",
      "Knees finish straight",
      "Press out until the knees are straight or only slightly bent.",
      "knee_L.flex",
      "start",
      6,
      26,
    ),
  ],
});
