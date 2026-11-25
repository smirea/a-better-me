import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { ALONG_Y, box, cylinder } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/**
 * Hinged row on a standing shrug / leverage machine. One arm pulls the handle
 * from a hang beside the thigh up and back toward the hip.
 */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.9,
  "root.z": 0.0,
  "root.pitch": 42,
  "hip.flex": 52,
  "hip.abd": 6,
  "knee.flex": 18,
  "ankle.dorsi": 6,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -2,
};

const HANG = {
  "shoulder.elev": 28,
  "shoulder.plane": 36,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 8,
  "wrist.flex": 2,
  "clavicle.elev": -4,
  "clavicle.prot": 4,
};

const ROW = {
  "shoulder.elev": 32,
  "shoulder.plane": 24,
  "shoulder.twist": 4,
  "elbow.flex": 100,
  "forearm.pron": 6,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -16,
};

const REST = {
  "shoulder.elev": 16,
  "shoulder.plane": 22,
  "elbow.flex": 12,
  "forearm.pron": 6,
  "clavicle.elev": -2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "shrug-machine-row",
  catalogId: "3895c6f170d88071b7f9d492f205d34a",
  name: "Shrug Machine Row",
  defaultLoadKg: 20,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Row", "Hip", "Lower", "Hang"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, heelZ: 0.02, toeOutDeg: 8, torsoLeanDeg: 42, balanceZ: 0.02 },
  apparatus: {
    kind: "machine-handles",
    orientation: "neutral",
    sides: ["L"],
    forceDir: [0, -1, 0.15],
  },
  extraEquipment: [
    box("shrug.base", [0, 0.04, -0.42], [0.9, 0.08, 0.5], "steel", false),
    box("shrug.stack", [0, 0.7, -0.68], [0.3, 1.1, 0.18], "plate", false),
    cylinder("shrug.postL", [0.48, 0.7, -0.16], 0.03, 1.3, "steel", ALONG_Y, false),
    cylinder("shrug.postR", [-0.48, 0.7, -0.16], 0.03, 1.3, "steel", ALONG_Y, false),
  ],
  extraContacts: {
    handle_L: { upperarm_L: 0.1, chest: 0.12, thigh_L: 0.1, shank_L: 0.1, forearm_L: 0.08, pelvis: 0.08 },
  },
  stiffness: { elbow: 2.4, shoulder: 1.2, lumbar: 8, hip: 3.2, knee: 3 },
  hints: {
    start: sidedHints("L", HANG, REST, HINGE),
    end: sidedHints("L", ROW, REST, HINGE),
  },
  checks: () => [
    checkFlatBack(
      "Hinge at the hips and keep the lower back near neutral while the shrug-machine handle rows up and back.",
    ),
    checkNeutralNeck("Keep the neck quiet. Do not crane to watch the handle."),
    checkJointRange(
      "shrug-row",
      "Elbow bends through the row",
      "Row the shrug-machine handle from a hang beside the thigh up and back by bending the elbow and retracting the shoulder blade.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arm-long",
      "Working arm starts long",
      "Start with the elbow nearly straight, holding the standing leverage handle.",
      "elbow_L.flex",
      "top",
      0,
      28,
    ),
    checkJointWithinAt(
      "neutral",
      "Neutral handle",
      "Hold the shrug-machine handle with a neutral grip beside the hip.",
      "forearm_L.pron",
      "start",
      -20,
      35,
    ),
    checkJointWithinAt(
      "scapula",
      "Shoulder blade pulls back",
      "Finish with the elbow beside the torso and the shoulder blade pulled back.",
      "clavicle_L.prot",
      "bottom",
      -40,
      -4,
    ),
  ],
});
