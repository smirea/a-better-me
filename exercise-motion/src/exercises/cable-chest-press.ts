import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Standing between two chest-height cables, staggered stance, palms down. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 12,
  "hip.flex": 6,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "clavicle.prot": -12,
  "clavicle.elev": 2,
};

const OPEN = {
  "shoulder.elev": 72,
  "shoulder.plane": -28,
  "shoulder.twist": 18,
  "elbow.flex": 88,
  "forearm.pron": 78,
  "wrist.flex": 0,
};

const PRESS = {
  "shoulder.elev": 78,
  "shoulder.plane": 58,
  "shoulder.twist": 22,
  "elbow.flex": 10,
  "forearm.pron": 74,
  "wrist.flex": 0,
  "clavicle.prot": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-chest-press",
  catalogId: "1a05c6f170d8809d80ecf8e7406e4601",
  name: "Cable Chest Press",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Open", "Stretch"],
  tempo: { lower: 1.6, bottom: 0.25, raise: 1.3, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, heelZ: 0.16, toeOutDeg: 8 },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 1.2,
    halfWidth: 0.7,
    z: 0.22,
    attachment: "d-handle",
    anchor: "press",
  },
  stiffness: { elbow: 3, shoulder: 0.7, lumbar: 7, knee: 4, hip: 3 },
  hints: {
    start: { ...TRUNK, ...OPEN },
    end: { ...TRUNK, ...PRESS },
  },
  checks: () => [
    checkFlatBack("Stand upright and keep the torso still while the arms press."),
    checkJointWithinAt(
      "arms-open",
      "Arms start spread behind the chest",
      "Let the cables pull the elbows back to about chest height before you press.",
      "elbow_L.flex",
      "start",
      60,
      115,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Arms finish outstretched",
      "Press the handles forward until the elbows are straight and the hands meet in front of the chest.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows straighten through the press",
      "Drive the elbows forward and inward, then let them arc back out to the sides.",
      "elbow_L.flex",
      55,
    ),
  ],
});
