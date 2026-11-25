import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Low pulley, about hip height. Arms start angled down, then rise into the same face-pull T. */
const REACH = {
  "shoulder.elev": 48,
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": 12,
};

const PULL = {
  "shoulder.elev": 88,
  "shoulder.plane": 12,
  "shoulder.twist": -56,
  "elbow.flex": 92,
  "forearm.pron": -26,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": -16,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 8,
  "knee.flex": 12,
  "lumbar.flex": 2,
  "thoracic.flex": -4,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "low-pulley-cable-face-pull",
  catalogId: "2ab5c6f170d88056b4b7ecef4d1ae9b4",
  name: "Low Pulley Cable Face Pull",
  defaultLoadKg: 10,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Face", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, heelZ: -0.06, torsoLeanDeg: 2, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.82, 1.12],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 1.2,
    freeGripWidth: true,
  },
  stiffness: { elbow: 4, shoulder: 0.85, lumbar: 8, thoracic: 6 },
  progress: (body, frame) => -anchorPoint(body, frame, "grip_L").z,
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "elbow_L.flex", 8, 30),
      lockAngle(body, "elbow_R.flex", 8, 30),
      lockAngle(body, "shoulder_L.elev", 48, 22),
      lockAngle(body, "shoulder_R.elev", 48, 22),
    ],
  }),
  hints: {
    start: { ...STANCE, ...REACH },
    end: { ...STANCE, ...PULL },
  },
  checks: () => [
    checkFlatBack("Stand upright. The cable travels diagonally upward, and the torso stays still."),
    checkNeutralNeck("Finish with the chest up and the neck quiet."),
    checkJointRange(
      "low-to-high",
      "Arms travel up from the low cable into a T",
      "Drive the elbows diagonally backward and upward, flaring them out, until the upper arms are about parallel with the ground.",
      "shoulder_L.elev",
      18,
    ),
    checkJointWithinAt(
      "arms-down",
      "Arms start angled down toward the low pulley",
      "Start with the elbows straight and the arms outstretched in line with the low cable.",
      "elbow_L.flex",
      "top",
      0,
      52,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows finish near 90 degrees",
      "Finish with the elbows bent about 90 degrees and the hands pulled back level with the elbows.",
      "elbow_L.flex",
      "bottom",
      70,
      115,
    ),
    checkJointWithinAt(
      "external-rotation",
      "Hands rotate back beside the face",
      "The end position resembles a double-biceps pose, not a row with the hands still in front of the elbows.",
      "shoulder_L.twist",
      "bottom",
      -90,
      -25,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Finish with the shoulder blades fully pulled back together.",
      "clavicle_L.prot",
      "bottom",
      -30,
      -6,
    ),
  ],
});
