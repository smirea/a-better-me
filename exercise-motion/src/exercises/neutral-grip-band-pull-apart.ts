import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Neutral-grip pull-apart: palms face each other, elbows straight, arms open to a T. */
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
  "shoulder.plane": 82,
  "shoulder.twist": -4,
  "elbow.flex": 6,
  "forearm.pron": 4,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": 6,
};

const TEE = {
  "shoulder.elev": 92,
  "shoulder.plane": 12,
  "shoulder.twist": 0,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-band-pull-apart",
  catalogId: "1ae5c6f170d8800b9065ee209498efee",
  name: "Neutral Grip Band Pull-Apart",
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
      "neutral-grip",
      "Palms face each other",
      "Grasp the band with the palms facing each other and keep that neutral grip as the arms open.",
      "forearm_L.pron",
      "start",
      -30,
      30,
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
      "t-shape",
      "Arms finish in a T",
      "Pull the hands apart and backward until the arms point out to the sides, level with the shoulders.",
      "shoulder_L.plane",
      "peak",
      -10,
      70,
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
