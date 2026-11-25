import { buildExerciseSpec, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
const TRUNK = {
  "root.y": 0.5,
  "root.z": -0.22,
  "root.pitch": -50,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.abd": 8,
  "hip.rot": 2,
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 8,
  "shoulder.twist": 10,
  "elbow.flex": 28,
  "forearm.pron": 35,
  "wrist.flex": 8,
};

const active = (ankle: number, knee: number) => ({
  "hip.flex": knee > 12 ? 54 : 46,
  "knee.flex": knee,
  "ankle.dorsi": ankle,
});

const rest = {
  "hip.flex": 62,
  "hip.abd": 16,
  "knee.flex": 88,
  "ankle.dorsi": 4,
};

export const spec = buildExerciseSpec({
  id: "single-leg-pin-loaded-leg-press-calf-raise",
  catalogId: "1ac5c6f170d88096a00cda012fa6cad7",
  name: "Single Leg Pin-Loaded Leg Press Calf Raise",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Press", "Point", "Lower", "Stretch"],
  tempo: { lower: 2.0, bottom: 0.35, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 45, singleLeg: "L", stanceX: 0.1 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  hints: {
    start: sidedHints("L", active(20, 16), rest, TRUNK),
    end: sidedHints("L", active(-30, 8), rest, TRUNK),
  },
  stiffness: { knee: 4, hip: 2.4, ankle: 2.2 },
  checks: () => [
    checkFlatBack("Keep your low back fairly flat against the backrest rather than rounding into a slouch."),
    checkNeutralNeck("Keep your neck near neutral while your back stays on the pad."),
    checkJointWithinAt(
      "knee-straight",
      "Working knee stays straight",
      "Keep the working knee straight or only slightly bent. Motion happens at the ankle, not the knee.",
      "knee_L.flex",
      "start",
      4,
      24,
    ),
    checkJointWithinAt(
      "knee-stays",
      "Working knee stays nearly straight",
      "Keep the knee only slightly bent while you point and lower the foot.",
      "knee_L.flex",
      "peak",
      2,
      18,
    ),
    checkJointRange(
      "ankle-rom",
      "Full ankle plantarflexion",
      "Point the ball of the foot away like a gas pedal, then lower the heel through the calf's available range.",
      "ankle_L.dorsi",
      40,
    ),
    checkJointWithinAt(
      "heel-stretch",
      "Heel drops into a calf stretch",
      "Lower the heel as far as mobility allows so the calf stretches at the bottom.",
      "ankle_L.dorsi",
      "start",
      8,
      32,
    ),
  ],
});
