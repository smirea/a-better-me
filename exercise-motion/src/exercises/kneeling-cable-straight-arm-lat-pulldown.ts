import { Vector3 } from "three";
import { buildExerciseSpec, lockTorsoPitch, POSTURE_HINTS } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { pin, plantToe } from "../solver";

/** Both knees on a mat, hips hinged so the straight arms line up with a high cable. */
const TRUNK = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.52,
  "root.pitch": 4,
  "hip.flex": 6,
  "knee.flex": 96,
  "ankle.dorsi": 12,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 8,
};

const OVERHEAD = {
  "shoulder.elev": 160,
  "shoulder.plane": 58,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 2,
};

const THIGHS = {
  ...OVERHEAD,
  "shoulder.elev": 40,
  "shoulder.plane": 58,
  "elbow.flex": 12,
  "clavicle.elev": -8,
  "clavicle.prot": -8,
};

export const spec = buildExerciseSpec({
  id: "kneeling-cable-straight-arm-lat-pulldown",
  catalogId: "2a05c6f170d8807ca8d5d6bc4ba615c4",
  name: "Kneeling Cable Straight Arm Lat Pulldown",
  defaultLoadKg: 8,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Pull", "Thighs", "Return", "Overhead"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.35 },
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.8, 1.4, -0.05),
  extraGoals: (body) => [
    pin(body, "kneeFront_L", () => new Vector3(0.14, 0.09, 0.02), 48),
    pin(body, "kneeFront_R", () => new Vector3(-0.14, 0.09, 0.02), 48),
    ...plantToe(body, "L", new Vector3(0.14, 0.045, -0.4), 0.08, 24),
    ...plantToe(body, "R", new Vector3(-0.14, 0.045, -0.4), 0.08, 24),
    lockTorsoPitch(body, 8, 24),
  ],
  apparatus: {
    kind: "cable-single",
    pulley: [0, 2.08, 0.72],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 0.34,
    gripX: 0.16,
  },
  stiffness: { elbow: 8, shoulder: 0.55, lumbar: 10, hip: 4, knee: 6 },
  hints: {
    start: { ...TRUNK, ...OVERHEAD },
    end: { ...TRUNK, ...THIGHS },
  },
  checks: () => [
    checkFlatBack(
      "Hinge the hips and keep the torso inclined with a flat back while the arms move.",
      16,
    ),
    checkJointWithinAt(
      "knees-down",
      "Both knees stay on the floor",
      "Kneel far enough from the stack that the cable is tight before the set starts.",
      "knee_L.flex",
      "top",
      80,
      140,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straightened",
      "Keep the elbows straight and the wrists fairly straight on the bar or rope.",
      "elbow_L.flex",
      "peak",
      0,
      26,
    ),
    checkJointWithinAt(
      "overhead",
      "Arms start overhead in line with the cable",
      "The hinge should put the arms fully overhead relative to comfortable shoulder mobility.",
      "shoulder_L.elev",
      "top",
      135,
      178,
    ),
    checkJointRange(
      "shoulder-extension",
      "Arms sweep down by the thighs",
      "Drive down, then pull back, until the hands are right by the thighs.",
      "shoulder_L.elev",
      85,
    ),
  ],
});
