import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Pulley above the head. Arms start high, then the elbows drop to shoulder height in a T. */
const REACH = {
  "shoulder.elev": 132,
  "shoulder.plane": 78,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 16,
  "clavicle.prot": 10,
};

const PULL = {
  "shoulder.elev": 86,
  "shoulder.plane": 12,
  "shoulder.twist": -56,
  "elbow.flex": 92,
  "forearm.pron": -26,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 8,
  "knee.flex": 14,
  "lumbar.flex": 2,
  "thoracic.flex": -4,
  "neck.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "high-pulley-cable-face-pull",
  catalogId: "2ab5c6f170d8800b8acaf4881fbf8131",
  name: "High Pulley Cable Face Pull",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Face", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.2, heelZ: 0.16, torsoLeanDeg: 6, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 1.95, 1.05],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 1.2,
    freeGripWidth: true,
  },
  stiffness: { elbow: 1.6, shoulder: 0.85, lumbar: 8, thoracic: 6 },
  progress: (body, frame) => -anchorPoint(body, frame, "grip_L").z,
  hints: {
    start: { ...STANCE, ...REACH },
    end: { ...STANCE, ...PULL },
  },
  checks: () => [
    checkFlatBack("Stand upright. The cable travels diagonally downward while the torso stays still."),
    checkNeutralNeck("Finish with the chest up and the neck quiet."),
    checkJointRange(
      "high-to-low",
      "Arms come down from the high cable into a T",
      "Drive the elbows diagonally backward and down toward shoulder height while the hands spread apart.",
      "shoulder_L.elev",
      24,
    ),
    checkJointWithinAt(
      "arms-high",
      "Arms start raised toward the high pulley",
      "Start with the elbows straightened and the arms raised in line with the high cable.",
      "shoulder_L.elev",
      "top",
      110,
      160,
    ),
    checkJointWithinAt(
      "t-shape",
      "Upper arms finish about parallel to the ground",
      "Finish with the elbows pointing out to the sides and the upper arms about parallel with the ground.",
      "shoulder_L.plane",
      "bottom",
      -8,
      36,
    ),
    checkJointWithinAt(
      "external-rotation",
      "Hands rotate back beside the face",
      "Strive to finish with the hands vertically above the elbows and the elbows bent about 90 degrees.",
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
