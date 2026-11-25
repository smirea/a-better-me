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

const DOWN = { "hip.flex": 88, "knee.flex": 92 };

export const spec = buildExerciseSpec({
  id: "bird-dog",
  catalogId: "1f55c6f170d8800ca9d6f5a31596a32d",
  name: "Bird Dog",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "alternating",
  grip: "open",
  brace: true,
  phaseLabels: ["Set", "Reach", "Return", "Switch"],
  tempo: { lower: 1.4, bottom: 0.6, raise: 1.4, top: 0.35 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 1.8, 0),
  extraGoals: (body) => [
    keepAbove(body, "palmFlat_L", 0.07, 70),
    keepAbove(body, "palmFlat_R", 0.07, 70),
    keepAbove(body, "toe_L", 0.02, 36),
    keepAbove(body, "toe_R", 0.02, 36),
    keepAbove(body, "ballIn_L", 0.02, 36),
    keepAbove(body, "ballIn_R", 0.04, 36),
  ],
  extraKeyGoals: (body) => ({
    start: [
      pin(body, "palmFlat_L", () => new Vector3(0.18, 0.08, 0.42), 36),
      pin(body, "palmFlat_R", () => new Vector3(-0.18, 0.08, 0.42), 36),
      pin(body, "kneeFront_L", () => new Vector3(0.12, 0.08, -0.08), 36),
      pin(body, "kneeFront_R", () => new Vector3(-0.12, 0.08, -0.08), 36),
    ],
    end: [
      pin(body, "palmFlat_R", () => new Vector3(-0.18, 0.08, 0.42), 36),
      pin(body, "kneeFront_L", () => new Vector3(0.12, 0.08, -0.08), 36),
    ],
  }),
  stiffness: { lumbar: 14, thoracic: 12, hip: 3, knee: 4, shoulder: 2, elbow: 8 },
  apparatus: { kind: "none" },
  hints: {
    start: { ...ALL_FOURS, ...DOWN },
    end: {
      ...sidedHints("R", { "hip.flex": -8, "knee.flex": 6 }, DOWN, ALL_FOURS),
      "shoulder_L.elev": 165,
      "shoulder_L.plane": 82,
      "elbow_L.flex": 8,
      "shoulder_R.elev": 78,
      "elbow_R.flex": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Brace the trunk so it stays rigid while the opposite arm and leg reach.",
      12,
    ),
    checkNeutralNeck("Keep the neck near the same neutral curve you use when standing."),
    checkJointRange(
      "leg-reach",
      "One leg reaches back",
      "Sweep one leg backward and straighten the knee, lifting it only as high as the trunk stays still.",
      "hip_R.flex",
      40,
    ),
    checkJointRange(
      "arm-reach",
      "The opposite arm reaches forward",
      "Reach the opposite arm forward with the elbow straight.",
      "shoulder_L.elev",
      28,
    ),
    checkJointWithinAt(
      "support-arm",
      "The supporting arm stays down",
      "Keep the supporting hand on the floor with the elbow straight.",
      "elbow_R.flex",
      "peak",
      0,
      24,
    ),
  ],
});
