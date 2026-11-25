import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Overhand band pull-apart. The band apparatus only anchors to fixed world points,
 * so both strands meet at a point between the hands and pull them toward the midline.
 */
const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 4,
  "knee.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 4,
};

const FRONT = {
  "shoulder.elev": 90,
  "shoulder.plane": 84,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 78,
  "wrist.flex": 2,
  "clavicle.elev": 8,
  "clavicle.prot": 6,
};

const TEE = {
  "shoulder.elev": 92,
  "shoulder.plane": 10,
  "shoulder.twist": 14,
  "elbow.flex": 6,
  "forearm.pron": 74,
  "wrist.flex": 2,
  "clavicle.elev": 10,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "band-pull-apart",
  catalogId: "1a15c6f170d88075bedff384fa3f8c3b",
  name: "Band Pull-Apart",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "T-shape", "Return", "Front"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6, balanceZ: false },
  apparatus: {
    kind: "band",
    anchors: [
      [0, 1.38, 0.42],
      [0, 1.38, 0.42],
    ],
  },
  stiffness: { elbow: 8, shoulder: 6, lumbar: 8, thoracic: 7 },
  hints: {
    start: { ...STAND, ...FRONT },
    end: { ...STAND, ...TEE },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright with the feet about shoulder width and keep the torso still while the arms move.",
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep the elbows straight as you pull the hands apart and backward into a T with the torso.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "arms-forward",
      "Arms start outstretched in front",
      "Start with the arms parallel to the ground in front of the torso, palms down, and slack already out of the band.",
      "shoulder_L.plane",
      "start",
      60,
      100,
    ),
    checkJointWithinAt(
      "overhand",
      "Overhand grip",
      "Grasp the band with an overhand grip so the palms face the ground.",
      "forearm_L.pron",
      "start",
      50,
      90,
    ),
    checkJointRange(
      "horizontal-extension",
      "Arms open into a T",
      "Pull the hands apart and backward until the arms and torso form a T, then return without letting the band go slack.",
      "shoulder_L.plane",
      20,
    ),
  ],
});
