import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Side-on to a chest-height band. Press straight out and refuse to rotate. */
const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 16,
  "hip.flex": 12,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "lumbar.twist": 0,
  "thoracic.twist": 0,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
};

const AT_CHEST = {
  "shoulder.elev": 38,
  "shoulder.plane": 72,
  "shoulder.twist": 6,
  "elbow.flex": 105,
  "forearm.pron": 40,
  "wrist.flex": 0,
  "clavicle.elev": 4,
};

const PRESSED = {
  ...AT_CHEST,
  "shoulder.elev": 88,
  "shoulder.plane": 80,
  "elbow.flex": 8,
  "clavicle.elev": 8,
};

export const spec = buildExerciseSpec({
  id: "banded-pallof-press",
  catalogId: "1a45c6f170d8802ba2dae19705a36c48",
  name: "Banded Pallof Press",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Press", "Out", "Return", "Chest"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, balanceZ: false },
  apparatus: {
    kind: "band",
    anchors: [
      [0.95, 1.22, 0.12],
      [0.95, 1.22, 0.12],
    ],
  },
  stiffness: { lumbar: 14, thoracic: 14, elbow: 3, shoulder: 2 },
  hints: {
    start: { ...STANCE, ...AT_CHEST },
    end: { ...STANCE, ...PRESSED },
  },
  checks: () => [
    checkJointRange(
      "press",
      "Hands press straight forward",
      "Press the hands forward until the elbows are straight and the arms are parallel to the ground.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "no-rotation",
      "Chest does not rotate toward the band",
      "Do not let the band rotate the torso. The center of the chest faces the same direction the whole set.",
      "thoracic.twist",
      "peak",
      -8,
      8,
    ),
    checkJointWithinAt(
      "lumbar-square",
      "Belt buckle stays forward",
      "Brace the obliques so the belt buckle does not turn toward the anchor.",
      "lumbar.twist",
      "peak",
      -6,
      6,
    ),
    checkJointWithinAt(
      "arms-forward",
      "Arms finish outstretched",
      "Finish with the arms outstretched in front of the chest, close to parallel to the ground.",
      "shoulder_L.elev",
      "bottom",
      70,
      110,
    ),
  ],
});
