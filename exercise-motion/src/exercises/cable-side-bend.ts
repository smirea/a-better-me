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

const HOLD = {
  "shoulder.elev": 18,
  "shoulder.plane": 8,
  "shoulder.twist": 4,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 0,
};

const FREE = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "elbow.flex": 8,
  "forearm.pron": 10,
};

export const spec = buildExerciseSpec({
  id: "cable-side-bend",
  catalogId: "1a45c6f170d88088a607cb473ed28d7f",
  name: "Cable Side Bend",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Lower", "Stretch", "Lift", "Upright"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 4, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.72, 0.22, 0.06],
    columnPos: [0.95, -0.04],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 8, lumbar: 4, thoracic: 4, hip: 8, knee: 8 },
  hints: {
    start: sidedHints("L", HOLD, FREE, { ...STANCE, "lumbar.bend": 0, "thoracic.bend": 0 }),
    end: sidedHints("L", { ...HOLD, "shoulder.elev": 28 }, FREE, {
      ...STANCE,
      "lumbar.bend": 20,
      "thoracic.bend": 18,
    }),
  },
  checks: () => [
    checkJointRange(
      "side-bend",
      "Torso bends toward the cable",
      "Bend the torso toward the cable station, then return until the shoulders are level.",
      "lumbar.bend",
      12,
    ),
    checkJointRange(
      "rib-cage",
      "Ribs move away from the hip",
      "The ribs on the far side move away from that hip bone as you lower toward the cable.",
      "thoracic.bend",
      10,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Keep the elbow straight so the arm stays in line with the cable.",
      "elbow_L.flex",
      "bottom",
      0,
      20,
    ),
    checkJointWithinAt(
      "no-flexion",
      "No forward bend",
      "Do not round the lower back forward or arch it backward. Bend only to the side.",
      "lumbar.flex",
      "bottom",
      -10,
      14,
    ),
  ],
});
