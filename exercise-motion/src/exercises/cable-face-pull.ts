import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/**
 * Chest-high rope. Start with long arms toward the pulley, palms down.
 * Finish in a T: elbows out, about 90°, hands rotated back beside the face.
 */
const REACH = {
  "shoulder.elev": 82,
  "shoulder.plane": 84,
  "shoulder.twist": 10,
  "elbow.flex": 6,
  "forearm.pron": 72,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": 12,
};

const PULL = {
  "shoulder.elev": 86,
  "shoulder.plane": 12,
  "shoulder.twist": -58,
  "elbow.flex": 92,
  "forearm.pron": -28,
  "wrist.flex": 0,
  "clavicle.elev": 10,
  "clavicle.prot": -16,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 8,
  "knee.flex": 14,
  "lumbar.flex": 2,
  "thoracic.flex": -4,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-face-pull",
  catalogId: "1a15c6f170d88014a710f8ada9a1e94a",
  name: "Cable Face Pull",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Face", "Return", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.2, heelZ: 0.08, torsoLeanDeg: 3, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 1.28, 1.15],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 1.2,
    freeGripWidth: true,
  },
  stiffness: { elbow: 2.4, shoulder: 1.3, lumbar: 8, thoracic: 6, clavicle: 1.2 },
  progress: (body, frame) => -anchorPoint(body, frame, "grip_L").z,
  hints: {
    start: { ...STANCE, ...REACH },
    end: { ...STANCE, ...PULL },
  },
  extraKeyGoals: (body) => ({
    end: [
      lockAngle(body, "elbow_L.flex", 92, 28),
      lockAngle(body, "elbow_R.flex", 92, 28),
      lockAngle(body, "shoulder_L.plane", 12, 22),
      lockAngle(body, "shoulder_R.plane", 12, 22),
      lockAngle(body, "shoulder_L.twist", -58, 18),
      lockAngle(body, "shoulder_R.twist", -58, 18),
      lockAngle(body, "clavicle_L.prot", -16, 20),
      lockAngle(body, "clavicle_R.prot", -16, 20),
    ],
  }),
  checks: () => [
    checkFlatBack(
      "Stand upright with a slight knee bend. Finish with the shoulder blades together and the chest up.",
    ),
    checkNeutralNeck("Keep the neck quiet in the proud-chest finish."),
    checkJointRange(
      "elbow-bend",
      "Elbows bend to about 90 degrees",
      "Drive the elbows back and out while the hands pull apart toward the eyes, finishing near a 90-degree elbow bend.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "arms-long",
      "Arms start outstretched toward the cable",
      "Start with the elbows straightened and the arms parallel with the cable, palms down and hands close together.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "t-shape",
      "Upper arms finish in a T",
      "At the end the elbows point straight out to the sides and the upper arms are about parallel with the ground.",
      "shoulder_L.plane",
      "bottom",
      -8,
      36,
    ),
    checkJointWithinAt(
      "external-rotation",
      "Hands rotate back beside the face",
      "Finish in a double-biceps pose, with the hands pulled as far back as the elbows rather than staying in front of them.",
      "shoulder_L.twist",
      "bottom",
      -90,
      -25,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Finish pulling with the shoulder blades fully pulled back together.",
      "clavicle_L.prot",
      "bottom",
      -30,
      -6,
    ),
  ],
});
