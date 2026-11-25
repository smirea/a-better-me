import { buildExerciseSpec, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const TRUNK = {
  "root.y": 0.5,
  "root.z": -0.18,
  "root.pitch": -50,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 8,
  "elbow.flex": 68,
  "forearm.pron": 24,
  "wrist.flex": 6,
};

const work = (knee: number, hip: number) => ({
  "hip.flex": hip,
  "hip.abd": 8,
  "hip.rot": 4,
  "knee.flex": knee,
  "ankle.dorsi": 10,
});

const rest = {
  "hip.flex": 48,
  "hip.abd": 26,
  "hip.rot": 4,
  "knee.flex": 96,
  "ankle.dorsi": 0,
};

export const spec = buildExerciseSpec({
  id: "single-leg-leverage-leg-press",
  catalogId: "3895c6f170d880228be2f9b197f1e215",
  name: "Single Leg Leverage Leg Press",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Deep", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 45, singleLeg: "L", stanceX: 0.1 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  stiffness: { knee: 1.1, hip: 1.0, lumbar: 6 },
  hints: {
    start: sidedHints("L", work(12, 50), rest, TRUNK),
    end: sidedHints("L", work(108, 96), rest, TRUNK),
  },
  checks: () => [
    checkFlatBack("Keep the buttocks on the seat and the lower back flat on the reclined backrest."),
    checkNeutralNeck("Keep the neck near neutral while the back stays supported."),
    checkJointWithinAt(
      "lockout",
      "Working knee straightens",
      "Press the platform away until the working knee is straight or only slightly bent.",
      "knee_L.flex",
      "top",
      2,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Working knee reaches a deep bend",
      "Lower until the working knee is bent by at least about 90 degrees, heel down.",
      "knee_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointRange(
      "knee-rom",
      "Single-leg press range",
      "Bend and extend the working knee and hip together. The other foot stays off the platform.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "resting-leg",
      "Resting foot stays off the sled",
      "Park the non-working foot where that leg cannot touch the platform.",
      "knee_R.flex",
      "bottom",
      70,
      120,
    ),
  ],
});
