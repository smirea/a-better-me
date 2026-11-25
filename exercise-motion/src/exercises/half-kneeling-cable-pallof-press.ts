import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { plantToe } from "../solver";

/** Left knee down beside the cable, right foot forward. Chest stays square while the arms press. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.72,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "lumbar.twist": 0,
  "thoracic.twist": 0,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
  "hip_R.flex": 92,
  "hip_R.abd": 4,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 22,
  "hip_L.abd": 4,
  "knee_L.flex": 100,
  "ankle_L.dorsi": 28,
};

const AT_CHEST = {
  "shoulder.elev": 36,
  "shoulder.plane": 70,
  "elbow.flex": 105,
  "forearm.pron": 36,
  "wrist.flex": 0,
};

const PRESSED = {
  "shoulder.elev": 68,
  "shoulder.plane": 78,
  "elbow.flex": 8,
  "forearm.pron": 36,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "half-kneeling-cable-pallof-press",
  catalogId: "2a05c6f170d88032be2ee6ccdc2bc2b9",
  name: "Half-Kneeling Cable Pallof Press",
  defaultLoadKg: 4,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Press", "Out", "Return", "Chest"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 2 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.85, 0.98, 0.16],
    columnPos: [1.05, 0.05],
    facingDir: -1,
    attachment: "d-handle",
    twoHandsOnOne: true,
  },
  extraGoals: (body) => [...plantToe(body, "L", new Vector3(0.14, 0.08, -0.56), 0, 110)],
  stiffness: { lumbar: 14, thoracic: 14, elbow: 10, shoulder: 3, knee: 6 },
  hints: {
    start: sidedHints("L", AT_CHEST, AT_CHEST, LEGS),
    end: sidedHints("L", PRESSED, PRESSED, LEGS),
  },
  checks: () => [
    checkJointRange(
      "press",
      "Handle presses straight forward",
      "Press the handle straight forward until the elbows are straight, without letting the cable rotate the chest.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "no-rotation",
      "Chest stays aligned with the belt buckle",
      "The center of the chest keeps facing the same direction as the imaginary belt buckle.",
      "thoracic.twist",
      "peak",
      -8,
      8,
    ),
    checkJointWithinAt(
      "down-knee",
      "Inside knee stays down",
      "The knee closer to the cable stays on the ground in the half-kneeling stance.",
      "knee_L.flex",
      "bottom",
      75,
      125,
    ),
    checkJointWithinAt(
      "front-knee",
      "Front knee stays bent",
      "The outside foot is forward with that knee bent and the torso upright.",
      "knee_R.flex",
      "bottom",
      60,
      120,
    ),
  ],
});
