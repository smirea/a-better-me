import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 4,
  "hip.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 0,
  "lumbar.twist": 0,
  "thoracic.twist": 0,
};

const LOADED = {
  "shoulder.elev": 32,
  "shoulder.plane": 68,
  "shoulder.twist": 2,
  "elbow.flex": 6,
  "forearm.pron": 6,
  "wrist.flex": 0,
};

const FREE = {
  "shoulder.elev": 12,
  "shoulder.plane": 20,
  "elbow.flex": 8,
  "forearm.pron": 12,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-side-bend",
  catalogId: "1a45c6f170d8805c8bc9f17b441a96d9",
  name: "Dumbbell Side Bend",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lower", "Stretch", "Lift", "Upright"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, balanceZ: false },
  apparatus: { kind: "dumbbells", sides: ["L"] },
  stiffness: { elbow: 8, lumbar: 4, thoracic: 4, hip: 8, knee: 8 },
  hints: {
    start: sidedHints("L", LOADED, FREE, { ...STANCE, "lumbar.bend": 0, "thoracic.bend": 0 }),
    end: sidedHints("L", LOADED, FREE, { ...STANCE, "lumbar.bend": 16, "thoracic.bend": 14 }),
  },
  checks: () => [
    checkJointRange(
      "side-bend",
      "Torso bends toward the dumbbell",
      "Lower the dumbbell toward the side of the knee by bending the torso toward that side.",
      "lumbar.bend",
      12,
    ),
    checkJointRange(
      "rib-cage",
      "Ribs move away from the hip",
      "On the far side, the ribs move away from the hip bone at the bottom of the bend.",
      "thoracic.bend",
      10,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Keep the elbow straight and the dumbbell beside the thigh.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
    checkJointWithinAt(
      "no-flexion",
      "No forward bend",
      "The motion is only a side bend. Do not round or arch the lower back.",
      "lumbar.flex",
      "bottom",
      -10,
      14,
    ),
  ],
});
