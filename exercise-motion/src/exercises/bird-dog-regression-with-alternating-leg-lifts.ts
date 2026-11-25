import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { keepAbove, pin } from "../solver";

const ALL_FOURS = {
  "root.y": 0.48,
  "root.z": 0,
  "root.pitch": 78,
  "lumbar.flex": 8,
  "thoracic.flex": 6,
  "neck.flex": 4,
  "hip.abd": 8,
  "ankle.dorsi": 8,
  "clavicle.prot": 8,
  "shoulder.elev": 78,
  "shoulder.plane": 84,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 74,
  "wrist.flex": 30,
};

const ARMS = {
  "shoulder.elev": 78,
  "shoulder.plane": 84,
  "elbow.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "bird-dog-regression-with-alternating-leg-lifts",
  catalogId: "1f55c6f170d88099ad39d4b6cc1cefb6",
  name: "Bird Dog Regression With Alternating Leg Lifts",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Set", "Lift", "Return", "Switch"],
  tempo: { lower: 1.3, bottom: 0.55, raise: 1.3, top: 0.3 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 1.8, 0),
  extraGoals: (body) => [
    pin(body, "palmFlat_L", () => new Vector3(0.18, 0.08, 0.42), 44),
    pin(body, "palmFlat_R", () => new Vector3(-0.18, 0.08, 0.42), 44),
    keepAbove(body, "toe_L", 0.02, 36),
    keepAbove(body, "toe_R", 0.02, 36),
    keepAbove(body, "ballIn_L", 0.02, 36),
    keepAbove(body, "ballIn_R", 0.02, 36),
  ],
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "kneeFront_L", () => new Vector3(0.12, 0.08, -0.08), 36),
      pin(body, "kneeFront_R", () => new Vector3(-0.12, 0.08, -0.08), 36),
    ],
    end: [pin(body, "kneeFront_L", () => new Vector3(0.12, 0.08, -0.08), 36)],
  }),
  stiffness: { lumbar: 14, thoracic: 12, hip: 3, knee: 4, elbow: 10 },
  apparatus: { kind: "none" },
  hints: {
    start: { ...ALL_FOURS, ...ARMS, "hip.flex": 88, "knee.flex": 92 },
    end: sidedHints(
      "R",
      { "hip.flex": -8, "knee.flex": 6 },
      { "hip.flex": 88, "knee.flex": 92 },
      { ...ALL_FOURS, ...ARMS },
    ),
  },
  checks: () => [
    checkFlatBack("Brace the trunk and lift one leg only as high as the back stays still.", 12),
    checkNeutralNeck("Keep the neck near neutral while both hands stay on the floor."),
    checkJointRange(
      "leg-lift",
      "One leg reaches back",
      "Sweep one leg backward, straighten the knee, and squeeze the glute.",
      "hip_R.flex",
      40,
    ),
    checkJointWithinAt(
      "arms-down",
      "Both arms stay on the floor",
      "Keep both palms down. Only the leg moves.",
      "shoulder_L.elev",
      "peak",
      60,
      100,
    ),
    checkJointWithinAt(
      "knee-straight",
      "The lifted knee straightens",
      "Straighten the knee of the leg you lift.",
      "knee_R.flex",
      "peak",
      0,
      24,
    ),
  ],
});
