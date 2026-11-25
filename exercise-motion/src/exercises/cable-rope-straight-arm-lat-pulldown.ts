import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Hip hinge facing a high pulley so a straight line runs from the hands through the hips. */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 12,
  "hip.flex": 16,
  "knee.flex": 10,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 8,
};

const OVERHEAD = {
  "shoulder.elev": 132,
  "shoulder.plane": 58,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 4,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 4,
};

const THIGHS = {
  ...OVERHEAD,
  "shoulder.elev": 42,
  "shoulder.plane": 62,
  "elbow.flex": 10,
  "clavicle.elev": -8,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "cable-rope-straight-arm-lat-pulldown",
  catalogId: "2ae5c6f170d8807da2dcd7bf23371d82",
  name: "Cable Rope Straight Arm Lat Pulldown",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Pull", "Thighs", "Return", "Overhead"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, torsoLeanDeg: 12, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 2.08, 0.72],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 0.34,
    gripX: 0.18,
  },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 12, thoracic: 10, hip: 8, knee: 6 },
  hints: {
    start: { ...TRUNK, ...OVERHEAD },
    end: { ...TRUNK, ...THIGHS },
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso inclined and the back flat so a mostly straight line runs from the arms through the shoulders to the hips.",
      18,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Sweep the arms with straightened elbows. The rope ends stay in a neutral grip.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "overhead",
      "Arms start overhead in line with the cable",
      "Hinge until the cable sits the arms fully overhead relative to what the shoulders comfortably allow.",
      "shoulder_L.elev",
      "top",
      140,
      178,
    ),
    checkJointWithinAt(
      "thighs",
      "Hands finish by the thighs",
      "Sweep the arms down and back until the hands are right by the thighs.",
      "shoulder_L.elev",
      "bottom",
      20,
      70,
    ),
    checkJointRange(
      "shoulder-extension",
      "Straight arms arc from overhead to the thighs",
      "Drive down through the first half, then pull back, while the rest of the body stays still.",
      "shoulder_L.elev",
      70,
    ),
  ],
});
