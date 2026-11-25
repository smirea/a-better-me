import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothToes } from "../postures";
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
  "hip.flex": 2,
  "knee.flex": 4,
};

const SUPPORT_ARM = {
  "shoulder.elev": 78,
  "shoulder.plane": 86,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 76,
  "wrist.flex": 40,
};

const START = { ...PLANK, ...SUPPORT_ARM };

/** Left hand leaves the floor and taps the front of the right shoulder. */
const PEAK = sidedHints(
  "L",
  {
    "shoulder.elev": 52,
    "shoulder.plane": 28,
    "shoulder.twist": 36,
    "elbow.flex": 118,
    "forearm.pron": 30,
    "wrist.flex": 8,
  },
  SUPPORT_ARM,
  PLANK,
);

export const spec = buildExerciseSpec({
  id: "tall-plank-with-shoulder-taps",
  catalogId: "1f55c6f170d8807e9830d734e7674ca6",
  name: "Tall Plank With Shoulder Taps",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Plank", "Tap", "Switch", "Tap"],
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.8, 1.9, -0.1),
  ground: "ballIn_L",
  extraGoals: (body) => [
    ...plantBothToes(body, 0.12, -0.72, 0.055, 60),
    keepAbove(body, "palmFlat_L", 0.07, 90),
    keepAbove(body, "palmFlat_R", 0.07, 90),
  ],
  extraRequired: [
    { label: "Left forefoot grounded", anchor: "ballIn_L", surfaceY: 0.055, allowSlide: true },
    { label: "Right forefoot grounded", anchor: "ballIn_R", surfaceY: 0.055, allowSlide: true },
  ],
  stiffness: { hip: 8, lumbar: 14, thoracic: 14, shoulder: 4, elbow: 3 },
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
      "Tighten your abdominal muscles and squeeze your glutes so the trunk stays rigid and does not rotate while you tap.",
      12,
    ),
    checkNeutralNeck("Keep your neck in a neutral position, as you would normally do when standing upright."),
    checkJointRange(
      "hand-lifts",
      "One hand lifts to the opposite shoulder",
      "Pick one hand up off the ground to tap the front of your opposite shoulder by bending your elbow, then return it.",
      "elbow_L.flex",
      50,
    ),
    checkJointWithinAt(
      "support-arm-straight",
      "The supporting arm stays straight",
      "Except for the one arm you are moving, the rest of your body should stay as stationary as you can.",
      "elbow_R.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Hips stay level",
      "Particularly avoid letting your trunk rotate so your chest turns to one side.",
      "thoracic.twist",
      "peak",
      -14,
      14,
    ),
  ],
});
