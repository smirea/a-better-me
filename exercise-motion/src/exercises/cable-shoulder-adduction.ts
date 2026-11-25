import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Standing side-on to a high pulley. The straight arm adducts in the frontal
 * plane from overhead down toward the hip.
 * https://ca.physitrack.com — cable at the side, pulley highest, pull the handle down toward the hip.
 */
const UP = {
  "shoulder.elev": 128,
  "shoulder.plane": 8,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 14,
  "clavicle.prot": -4,
};

const DOWN = {
  "shoulder.elev": 16,
  "shoulder.plane": 6,
  "shoulder.twist": 4,
  "elbow.flex": 10,
  "forearm.pron": 68,
  "wrist.flex": 2,
  "clavicle.elev": -6,
  "clavicle.prot": -8,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 20,
  "elbow.flex": 8,
  "forearm.pron": 10,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-shoulder-adduction",
  catalogId: "3dc5c6f170d8808b84cac857b5cea1a7",
  name: "Cable Shoulder Adduction",
  defaultLoadKg: 2,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Pull", "Hip", "Return", "Overhead"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.28, heelZ: -0.04, toeOutDeg: 8, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.55, 2.2, 0.1],
    columnPos: [0.55, -0.55],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 8, shoulder: 0.6, lumbar: 10 },
  hints: {
    start: sidedHints("L", UP, REST, POSTURE_HINTS.standing),
    end: sidedHints("L", DOWN, REST, POSTURE_HINTS.standing),
  },
  checks: () => [
    checkFlatBack(
      "Stand firm with the core on, sideways to the high pulley, and keep the torso still while the arm moves.",
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow stays straight",
      "Keep the working elbow straight so the motion is shoulder adduction, not a pulldown curl.",
      "elbow_L.flex",
      "peak",
      0,
      24,
    ),
    checkJointWithinAt(
      "frontal-overhead",
      "Arm starts overhead and out to the side",
      "Begin with the arm abducted overhead in the frontal plane, in line with the high cable.",
      "shoulder_L.elev",
      "top",
      105,
      160,
    ),
    checkJointWithinAt(
      "to-hip",
      "Hand finishes toward the hip",
      "Pull the handle down toward the hip, arm staying in the frontal plane.",
      "shoulder_L.elev",
      "bottom",
      0,
      40,
    ),
    checkJointRange(
      "adduction",
      "Shoulder adducts from overhead to the side",
      "Return the arm overhead under control. Do not let the cable yank it up.",
      "shoulder_L.elev",
      90,
    ),
  ],
});
