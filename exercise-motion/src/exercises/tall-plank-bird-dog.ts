import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove } from "../solver";

const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.58,
  "root.pitch": 84,
  "lumbar.flex": 10,
  "thoracic.flex": 6,
  "neck.flex": 2,
  "hip.abd": 8,
  "ankle.dorsi": 8,
  "clavicle.prot": 12,
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 40,
  "hip.flex": 2,
  "knee.flex": 4,
};

const START = { ...PLANK };

/**
 * Right leg and left arm lift just clear of the floor.
 * sidedHints active side is the leg; the opposite arm is spelled out.
 */
const PEAK = {
  ...sidedHints("R", { "hip.flex": -16, "knee.flex": 4 }, { "hip.flex": 4, "knee.flex": 4 }, PLANK),
  "shoulder_L.elev": 128,
  "shoulder_L.plane": 82,
  "shoulder_L.twist": 10,
  "elbow_L.flex": 8,
  "shoulder_R.elev": 78,
  "shoulder_R.plane": 86,
  "elbow_R.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "tall-plank-bird-dog",
  catalogId: "1f55c6f170d880dc9272fc21c90d01f5",
  name: "Tall Plank Bird Dog",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "Reach", "Switch", "Reach"],
  tempo: { lower: 1.2, bottom: 0.4, raise: 1.2, top: 0.5 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.8, 1.9, -0.1),
  extraGoals: (body) => [
    keepAbove(body, "palmFlat_L", 0.07, 100),
    keepAbove(body, "palmFlat_R", 0.07, 100),
    keepAbove(body, "ballIn_L", 0.05, 70),
    keepAbove(body, "ballIn_R", 0.05, 70),
  ],
  stiffness: { hip: 4, lumbar: 14, thoracic: 12, shoulder: 4, elbow: 8, knee: 8 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: { start: START, end: PEAK },
  checks: () => [
    checkFlatBack(
      "Tighten your abdominal muscles and squeeze your glutes so your trunk stays rigid while the opposite arm and leg lift.",
      12,
    ),
    checkNeutralNeck("Keep your neck in a neutral position, as you would normally do when standing upright."),
    checkJointRange(
      "leg-lifts",
      "One leg lifts just off the floor",
      "Lift one leg only as high as you can while keeping your trunk rigid and your knee straight.",
      "hip_R.flex",
      10,
    ),
    checkJointRange(
      "arm-reaches",
      "The opposite arm reaches forward",
      "Lift the opposite arm slightly up off the ground while the rest of your body stays stationary.",
      "shoulder_L.elev",
      25,
    ),
    checkJointWithinAt(
      "support-arm-straight",
      "The supporting arm stays straight",
      "Keep your elbows straightened, including the arm that stays on the ground.",
      "elbow_R.flex",
      "peak",
      0,
      24,
    ),
  ],
});
