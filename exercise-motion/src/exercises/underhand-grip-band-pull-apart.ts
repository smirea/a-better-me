import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Underhand pull-apart: palms face up, elbows straight, arms open from in front to a T. */
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
  "shoulder.twist": -20,
  "elbow.flex": 6,
  "forearm.pron": -55,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": 6,
};

const TEE = {
  "shoulder.elev": 92,
  "shoulder.plane": 12,
  "shoulder.twist": -16,
  "elbow.flex": 6,
  "forearm.pron": -48,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "underhand-grip-band-pull-apart",
  catalogId: "1a45c6f170d880cd8b06d551953d6054",
  name: "Underhand Grip Band Pull-Apart",
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
      "underhand",
      "Underhand grip",
      "Grasp the band with an underhand grip so the palms face up while the arms are outstretched in front.",
      "forearm_L.pron",
      "start",
      -80,
      -20,
    ),
    checkJointWithinAt(
      "arms-forward",
      "Arms start outstretched in front",
      "Start with the arms about parallel to the ground and the hands a little wider than the shoulders, with the slack already out of the band.",
      "shoulder_L.elev",
      "start",
      70,
      110,
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
