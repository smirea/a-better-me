import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

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
  id: "ankle-banded-lateral-walk",
  catalogId: "1a35c6f170d88025a7a1f34e94c394c5",
  name: "Ankle-Banded Lateral Walk",
  defaultLoadKg: 5,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  phaseLabels: ["Step out", "Wide", "Step in", "Athletic"],
  tempo: { lower: 1.1, bottom: 0.2, raise: 1.1, top: 0.25 },
  station: { kind: "cardio", machine: "none" },
  apparatus: {
    kind: "band",
    anchors: [
      [0.02, 0.18, 0.06],
      [-0.02, 0.18, 0.06],
    ],
    targetAnchors: ["ankleCuff_L", "ankleCuff_R"],
  },
  stiffness: { hip: 5, knee: 6, lumbar: 8, ankle: 5 },
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
      "Drive both knees out so the band around the ankles cannot pull the shins inward.",
      "hip_L.abd",
      "peak",
      16,
      42,
    ),
    checkJointRange(
      "step-out",
      "Lead hip steps out",
      "Take a short step to the side, then bring the trail foot in without letting the band go slack.",
      "hip_L.abd",
      10,
    ),
  ],
});
