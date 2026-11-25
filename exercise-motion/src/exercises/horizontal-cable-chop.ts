import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 20,
  "hip.flex": 16,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 2,
  "lumbar.bend": 0,
  "thoracic.bend": 0,
};

const ARMS = {
  "shoulder.elev": 86,
  "shoulder.plane": 78,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 40,
  "wrist.flex": 0,
  "clavicle.elev": 6,
};

export const spec = buildExerciseSpec({
  id: "horizontal-cable-chop",
  catalogId: "1a45c6f170d88035ab3afd5eb64455a4",
  name: "Horizontal Cable Chop",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Rotate", "Away", "Return", "Toward"],
  tempo: { lower: 1.4, bottom: 0.2, raise: 1.5, top: 0.25 },
  station: { kind: "standing", stanceX: 0.2, toeOutDeg: 8, balanceZ: 0.02 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.62, 1.15, 0.08],
    columnPos: [0.82, -0.02],
    facingDir: -1,
    attachment: "d-handle",
    twoHandsOnOne: true,
  },
  stiffness: { elbow: 8, lumbar: 8, thoracic: 12, hip: 6, knee: 6 },
  hints: {
    start: { ...STANCE, ...ARMS, "lumbar.twist": -8, "thoracic.twist": -28 },
    end: { ...STANCE, ...ARMS, "lumbar.twist": 8, "thoracic.twist": 28 },
  },
  checks: () => [
    checkJointRange(
      "trunk-rotation",
      "Chest rotates across the body",
      "Rotate the chest toward the cable, then fully away, with the handle staying in front of the chest.",
      "thoracic.twist",
      32,
    ),
    checkJointWithinAt(
      "arms-forward",
      "Arms stay outstretched",
      "Keep the elbows straight and the handle in front of the chest, close to parallel to the ground.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "level",
      "Chop stays horizontal",
      "The handle travels in a horizontal arc at about chest height.",
      "shoulder_L.elev",
      "peak",
      70,
      105,
    ),
    checkJointWithinAt(
      "hips-quiet",
      "Belt buckle stays forward",
      "If the belt buckle turns with the chest, the rotation is happening at the hips instead of the trunk.",
      "hip_L.rot",
      "peak",
      -20,
      20,
    ),
  ],
});
