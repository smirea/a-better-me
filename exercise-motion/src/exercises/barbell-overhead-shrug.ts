import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/**
 * Arms stay locked overhead. The shrug is scapular elevation plus a little upward rotation,
 * which lifts the bar a short distance toward the ceiling.
 */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -2,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
};

const ARMS = {
  "shoulder.elev": 166,
  "shoulder.plane": 12,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "barbell-overhead-shrug",
  catalogId: "3595c6f170d880a5b6e6f54871c6297f",
  name: "Barbell Overhead Shrug",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.17, toeOutDeg: 8, balanceZ: 0.08 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.4,
    anchor: "press",
    path: { startY: 2.02, startZ: 0.08, endY: 2.12, endZ: 0.06, arcBulgeZ: 0 },
  },
  stiffness: { elbow: 7, knee: 5, hip: 4, shoulder: 1.6, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "press_L").y,
  extraGoals: (body) => [
    lockAngle(body, "hip_L.flex", 6, 40),
    lockAngle(body, "hip_R.flex", 6, 40),
    lockAngle(body, "lumbar.flex", -2, 36),
    lockAngle(body, "clavicle_L.prot", 2, 14),
    lockAngle(body, "clavicle_R.prot", 2, 14),
    lockAngle(body, "shoulder_L.elev", 164, 6),
    lockAngle(body, "shoulder_R.elev", 164, 6),
  ],
  hints: {
    start: { ...TRUNK, ...ARMS, "clavicle.elev": 8, "clavicle.prot": 0, "neck.flex": 0 },
    end: { ...TRUNK, ...ARMS, "clavicle.elev": 26, "clavicle.prot": 4, "shoulder.elev": 168 },
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso upright. Avoid leaning back through an excessive lower-back arch while the bar is overhead.",
      16,
    ),
    checkNeutralNeck("Look straight ahead so the neck stays near neutral throughout the shrug."),
    checkFeetPlanted("Set the feet about shoulder-width apart and keep them planted."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows stay locked overhead",
      "Shrug the shoulders up toward the ears while the arms stay overhead with straight elbows.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "overhead",
      "Arms stay overhead",
      "The rest of the body stays stationary while the shoulder girdle moves the bar.",
      "shoulder_L.elev",
      "peak",
      145,
      178,
    ),
    checkJointRange(
      "scapular-elevation",
      "Scapulae elevate overhead",
      "Shrug fully up toward the ears, then let the shoulders descend under control.",
      "clavicle_L.elev",
      14,
    ),
  ],
});
