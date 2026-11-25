import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Chest-high rope pulled to a T: elbows flare straight out, hands stay in front of the shoulders. */
const ARMS_REACH = {
  "shoulder.elev": 78,
  "shoulder.plane": 84,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 70,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": 6,
};

const ARMS_PULL = {
  "shoulder.elev": 55,
  "shoulder.plane": 30,
  "shoulder.twist": 8,
  "elbow.flex": 125,
  "forearm.pron": 50,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -16,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.flex": 10,
  "knee.flex": 12,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-rope-high-row",
  catalogId: "2c25c6f170d8802faccbc731f2c08731",
  name: "Cable Rope High Row",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "T", "Return", "Reach"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.22, heelZ: -0.04, torsoLeanDeg: 2, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 1.35, 1.2],
    facingDir: -1,
    attachment: "rope",
    attachmentWidth: 0.4,
    gripX: 0.12,
  },
  stiffness: { elbow: 2.2, shoulder: 1.1 },
  hints: {
    start: { ...STANCE, ...ARMS_REACH },
    end: { ...STANCE, ...ARMS_PULL },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright with a slight knee bend and keep your torso still while your arms row.",
    ),
    checkNeutralNeck("Keep your chest up and your neck quiet in the proud-chest finish."),
    checkJointRange(
      "elbow-row",
      "Elbows bend as the rope comes to the shoulders",
      "Drive your elbows backward while flaring them straight out away from your sides.",
      "elbow_L.flex",
      25,
    ),
    checkJointWithinAt(
      "arms-forward",
      "Arms start outstretched toward the cable",
      "Start with your elbows straightened and your arms raised parallel with the cable.",
      "elbow_L.flex",
      "top",
      0,
      100,
    ),
    checkJointWithinAt(
      "t-shape",
      "Elbows finish out to the sides",
      "Your elbows should finish pointing straight out to your sides, with your upper arms about parallel to the ground.",
      "shoulder_L.plane",
      "bottom",
      10,
      70,
    ),
    checkJointWithinAt(
      "scapulae-together",
      "Shoulder blades pull together",
      "Finish with your shoulder blades fully pulled back and your chest up.",
      "clavicle_L.prot",
      "bottom",
      -28,
      -6,
    ),
  ],
});
