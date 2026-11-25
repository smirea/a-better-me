import { buildExerciseSpec, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const TRUNK = {
  "root.y": 0.5,
  "root.z": -0.16,
  "root.pitch": -50,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 4,
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 8,
  "elbow.flex": 70,
  "forearm.pron": 24,
  "wrist.flex": 6,
};

const work = (knee: number, hip: number) => ({
  "hip.flex": hip,
  "hip.abd": 6,
  "hip.rot": 2,
  "knee.flex": knee,
  "ankle.dorsi": 8,
});

const rest = {
  "hip.flex": 46,
  "hip.abd": 28,
  "knee.flex": 98,
  "ankle.dorsi": 0,
};

export const spec = buildExerciseSpec({
  id: "single-leg-plate-loaded-horizontal-leg-press",
  catalogId: "3895c6f170d88062aee4dcdb24332442",
  name: "Single Leg Plate-Loaded Horizontal Leg Press",
  defaultLoadKg: 22,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Deep", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 15, singleLeg: "L", stanceX: 0.1 },
  apparatus: { kind: "leg-press-sled", angleDeg: 15, anchor: "ball" },
  stiffness: { knee: 1.1, hip: 1.0, lumbar: 6 },
  hints: {
    start: sidedHints("L", work(12, 48), rest, TRUNK),
    end: sidedHints("L", work(108, 100), rest, TRUNK),
  },
  checks: () => [
    checkFlatBack(
      "Set the seat so the working hip can bend fully without the lower back rounding off the backrest.",
    ),
    checkNeutralNeck("Keep the neck near neutral, head on the pad or just in front of it."),
    checkJointWithinAt(
      "lockout",
      "Working knee straightens",
      "Drive the working foot into the footplate until that knee is straight or only slightly bent.",
      "knee_L.flex",
      "top",
      2,
      24,
    ),
    checkJointWithinAt(
      "depth",
      "Working knee bends to about 90 degrees or more",
      "Bring the horizontal footplate back until the working knee is deeply bent, heel still down.",
      "knee_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointRange(
      "knee-rom",
      "Horizontal single-leg press",
      "Push the near-horizontal sled away by extending the working knee and hip together.",
      "knee_L.flex",
      70,
    ),
    checkJointWithinAt(
      "foot-lined-up",
      "Working hip stays near the body's midline",
      "Place the working foot in line with the hip, not way out to the side.",
      "hip_L.abd",
      "bottom",
      -8,
      20,
    ),
  ],
});
