import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.4,
  "root.pitch": 84,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.abd": 8,
  "ankle.dorsi": 6,
  "clavicle.prot": 12,
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 40,
};

const START = {
  ...PLANK,
  "hip.flex": 4,
  "knee.flex": 6,
};

/** Left peak: left knee marches toward the chest while the right leg stays long. */
const PEAK = sidedHints(
  "L",
  { "hip.flex": 48, "knee.flex": 42, "ankle.dorsi": 12 },
  { "hip.flex": 6, "knee.flex": 6, "ankle.dorsi": 12 },
  PLANK,
);

export const spec = buildExerciseSpec({
  id: "running-mountain-climber",
  catalogId: "2875c6f170d88010b52dcec52b219805",
  name: "Running Mountain Climber",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "March", "Switch", "March"],
  tempo: { lower: 0.7, bottom: 0.08, raise: 0.7, top: 0.08 },
  stiffness: { hip: 3, knee: 2.5, ankle: 10, lumbar: 12, thoracic: 12, shoulder: 8, elbow: 6 },
  station: {
    kind: "pushup",
    forearmsOnFloor: false,
    handX: 0.26,
    handZ: 0.5,
    handElevationY: 0.05,
    feetElevationY: 0.05,
    footZ: -0.72,
    footX: 0.1,
  },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.3, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes to flatten your lower back so you can draw a straight line from your knees through your hips to your shoulders.",
      12,
    ),
    checkNeutralNeck("Keep your neck near a neutral position as you would normally do when standing upright."),
    checkJointWithinAt(
      "arms-stay-straight",
      "Arms stay straight under the shoulders",
      "Your shoulders stay stacked over your wrists. Do not let your arms rock, and push the ground away so your shoulder blades stay spread.",
      "elbow_L.flex",
      "peak",
      -8,
      40,
    ),
    checkJointRange(
      "knee-march",
      "One knee marches toward the chest",
      "Explosively march one knee forward and up toward your chest while the other leg drives back.",
      "knee_L.flex",
      30,
    ),
    checkJointRange(
      "hip-drive",
      "Hips flex and extend as the legs switch",
      "Move each leg reciprocally at the same speed as if you were running.",
      "hip_L.flex",
      18,
    ),
  ],
});
