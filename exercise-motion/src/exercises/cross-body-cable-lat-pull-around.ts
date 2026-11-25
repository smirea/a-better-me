import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { plantToe } from "../solver";

/**
 * Pulley is on the right, near shoulder height. Left arm reaches across the body
 * and pulls the handle around to the left side. Right foot is forward.
 */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.74,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  "hip_R.flex": 92,
  "hip_R.abd": 4,
  "knee_R.flex": 94,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 28,
  "hip_L.abd": 4,
  "knee_L.flex": 102,
  "ankle_L.dorsi": 25,
};

const ACTIVE_ACROSS = {
  "shoulder.elev": 64,
  "shoulder.plane": 92,
  "shoulder.twist": -20,
  "elbow.flex": 16,
  "forearm.pron": -55,
  "wrist.flex": 2,
  "clavicle.elev": 8,
  "clavicle.prot": 18,
};

const ACTIVE_SIDE = {
  "shoulder.elev": 36,
  "shoulder.plane": 28,
  "shoulder.twist": -8,
  "elbow.flex": 88,
  "forearm.pron": -60,
  "wrist.flex": 4,
  "clavicle.elev": 0,
  "clavicle.prot": -12,
};

const REST = {
  "shoulder.elev": 28,
  "shoulder.plane": 55,
  "elbow.flex": 70,
  "forearm.pron": 10,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "cross-body-cable-lat-pull-around",
  catalogId: "2aa5c6f170d8809c8e4cf406941af120",
  name: "Cross-Body Cable Lat Pull-Around",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Side", "Return", "Across"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 2 },
  apparatus: {
    kind: "cable-single",
    pulley: [-0.95, 1.22, 0.2],
    columnPos: [-1.05, 0.32],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", ACTIVE_ACROSS, REST, LEGS),
    end: sidedHints("L", ACTIVE_SIDE, REST, LEGS),
  },
  extraGoals: (body) => plantToe(body, "L", new Vector3(0.14, 0.08, -0.56), 0, 110),
  checks: () => [
    checkJointRange(
      "shoulder-around",
      "Arm sweeps from across the body to the side",
      "Drive your elbow diagonally outward and down toward your side, then let the cable pull the arm back across the body.",
      "shoulder_L.plane",
      40,
    ),
    checkJointWithinAt(
      "arm-across",
      "Arm starts across the body",
      "Let the cable keep the working arm pulled across your body, angled toward the pulley, with the palm facing backward.",
      "shoulder_L.plane",
      "top",
      80,
      140,
    ),
    checkJointWithinAt(
      "elbow-side",
      "Elbow finishes by the side",
      "Finish with your elbow bent by your side and the handle in front of your torso.",
      "elbow_L.flex",
      "bottom",
      60,
      120,
    ),
    checkJointWithinAt(
      "palm-back",
      "Palm faces backward",
      "Hold the handle with your palm facing backward.",
      "forearm_L.pron",
      "top",
      -90,
      -25,
    ),
    checkJointWithinAt(
      "torso-square",
      "Torso stays square",
      "Keep the center of your chest and your hips facing straight ahead rather than twisting toward the pulley.",
      "thoracic.flex",
      "bottom",
      -12,
      12,
    ),
    checkJointWithinAt(
      "down-knee",
      "Far knee stays down",
      "The knee farther from the pulley rests on the ground while the near-side foot is forward.",
      "knee_L.flex",
      "bottom",
      80,
      130,
    ),
  ],
});
