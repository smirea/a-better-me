import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** One D-handle from elbow height. The working arm finishes in a T with the palm forward. */
const REACH = {
  "shoulder.elev": 78,
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": 10,
};

const PULL = {
  "shoulder.elev": 84,
  "shoulder.plane": 14,
  "shoulder.twist": -52,
  "elbow.flex": 92,
  "forearm.pron": -36,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -14,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "shoulder.twist": 4,
  "elbow.flex": 10,
  "forearm.pron": 10,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 8,
  "knee.flex": 12,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-face-pull",
  catalogId: "1b05c6f170d880898c3ade3eb3d10e80",
  name: "Single Arm Cable Face Pull",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Pull", "Face", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, torsoLeanDeg: 2, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.08, 1.05, 1.12],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 1.6, shoulder: 0.85, lumbar: 8 },
  hints: {
    start: sidedHints("L", REACH, REST, STANCE),
    end: sidedHints("L", PULL, REST, STANCE),
  },
  checks: () => [
    checkFlatBack("Stand facing the cable and keep the torso still while one arm pulls."),
    checkNeutralNeck("Keep the neck quiet as the handle comes up toward the face."),
    checkJointRange(
      "elbow-bend",
      "Working elbow bends to about 90 degrees",
      "Bend the elbow and pull the handle backward and upward until the upper arm is in line with the torso.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arm-long",
      "Arm starts outstretched",
      "Start with the elbow extended and the arm outstretched in front of the torso, palm down.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "upper-arm-level",
      "Upper arm finishes about parallel to the ground",
      "Finish with the upper arm approximately parallel with the ground and the palm facing forward.",
      "shoulder_L.plane",
      "bottom",
      -8,
      40,
    ),
    checkJointWithinAt(
      "palm-forward",
      "Palm finishes facing forward",
      "At the end of the pull the palm faces forward, which is the external-rotation finish.",
      "shoulder_L.twist",
      "bottom",
      -90,
      -20,
    ),
  ],
});
