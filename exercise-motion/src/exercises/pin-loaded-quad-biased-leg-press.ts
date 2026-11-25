import { buildExerciseSpec } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const SEATED = {
  "root.y": 0.5,
  "root.z": -0.02,
  "root.pitch": -44,
  "hip.abd": 10,
  "hip.rot": 6,
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
  id: "pin-loaded-quad-biased-leg-press",
  catalogId: "2aa5c6f170d8805592e1d2bcf9f94ff8",
  name: "Pin-Loaded Quad-Biased Leg Press",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2.1, bottom: 0.3, raise: 1.5, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 15, stanceX: 0.13 },
  apparatus: { kind: "leg-press-sled", angleDeg: 15, anchor: "ball" },
  stiffness: { knee: 3.6, hip: 1.8, ankle: 1.2 },
  hints: {
    start: { ...SEATED, "hip.flex": 50, "knee.flex": 18, "ankle.dorsi": 12 },
    end: { ...SEATED, "hip.flex": 76, "knee.flex": 122, "ankle.dorsi": 26 },
  },
  checks: () => [
    checkFlatBack("Keep the lower back flat and both heels on the lower half of the platform."),
    checkNeutralNeck("Keep the neck near neutral."),
    checkJointWithinAt(
      "deep-knees",
      "Knees bend deeply",
      "Feet on the lower half of the platform let the knees bend well past 90 degrees.",
      "knee_L.flex",
      "peak",
      105,
      140,
    ),
    checkJointWithinAt(
      "ankles-fold",
      "Ankles dorsiflex over the toes",
      "Low foot placement sends the knees forward. Keep the heels down through that ankle bend.",
      "ankle_L.dorsi",
      "peak",
      14,
      40,
    ),
    checkJointRange(
      "knee-rom",
      "Knees take the long range",
      "Press evenly through the whole foot until the knees are nearly straight, then lower under control.",
      "knee_L.flex",
      80,
    ),
  ],
});
