import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Athletic quarter-squat. A loop band around the lower thighs pulls the knees in. */
const ARMS = {
  "shoulder.elev": 28,
  "shoulder.plane": 62,
  "shoulder.twist": 8,
  "elbow.flex": 88,
  "forearm.pron": 28,
  "wrist.flex": 4,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.93,
  "root.pitch": 16,
  "lumbar.flex": 6,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "hip.flex": 38,
  "knee.flex": 42,
  "ankle.dorsi": 16,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "thigh-banded-lateral-walk",
  catalogId: "1a35c6f170d88043b47fffc9c066f89c",
  name: "Thigh-Banded Lateral Walk",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  phaseLabels: ["Step out", "Wide", "Step in", "Athletic"],
  tempo: { lower: 1.1, bottom: 0.2, raise: 1.1, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  apparatus: {
    kind: "band",
    anchors: [
      [0.02, 0.55, 0.08],
      [-0.02, 0.55, 0.08],
    ],
    targetAnchors: ["thighOuter_L", "thighOuter_R"],
  },
  stiffness: { hip: 5, knee: 6, lumbar: 8, ankle: 4 },
  hints: {
    start: { ...STANCE, "root.x": 0, "hip.abd": 12 },
    end: sidedHints("L", { "hip.abd": 30, "knee.flex": 44 }, { "hip.abd": 10, "knee.flex": 40 }, {
      ...STANCE,
      "root.x": 0.14,
    }),
  },
  checks: () => [
    checkFlatBack(
      "Keep your chest up and your back near neutral, and stay in the same mild torso lean rather than bobbing.",
      14,
    ),
    checkJointWithinAt(
      "quarter-squat",
      "Athletic quarter-squat",
      "Sit the hips back slightly and keep a mild bend in the hips and knees for the whole set.",
      "knee_L.flex",
      "start",
      28,
      58,
    ),
    checkJointWithinAt(
      "knees-out",
      "Knees stay pushed out",
      "Drive both knees out against the band so each knee stays over the middle of the foot.",
      "hip_L.abd",
      "peak",
      16,
      42,
    ),
    checkJointRange(
      "step-out",
      "Lead hip steps out",
      "Take a short step to the side by pushing the lead knee out, then bring the trail foot in.",
      "hip_L.abd",
      10,
    ),
  ],
});
