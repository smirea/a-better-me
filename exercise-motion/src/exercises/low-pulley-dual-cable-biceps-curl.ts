import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Centered between two low pulleys, stepped forward so the cables pull back and out.
 * Elbows curl the handles up and in while the upper arms stay put.
 */
const ARMS = {
  "shoulder.elev": 38,
  "shoulder.plane": -18,
  "shoulder.twist": -22,
  "forearm.pron": -70,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": -6,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 14,
  "hip.flex": 6,
  "root.pitch": 2,
  "thoracic.flex": -2,
};

export const spec = buildExerciseSpec({
  id: "low-pulley-dual-cable-biceps-curl",
  catalogId: "1a15c6f170d8801d8700fbf97435a960",
  name: "Low Pulley Dual Cable Biceps Curl",
  defaultLoadKg: 2.5,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Peak", "Lower", "Reach"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.22, heelZ: 0.02, toeOutDeg: 8, balanceZ: false },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.34,
    halfWidth: 0.88,
    z: -0.62,
    attachment: "d-handle",
  },
  stiffness: { elbow: 4.5, shoulder: 2.2, lumbar: 8 },
  hints: {
    start: { ...STANCE, ...ARMS, "elbow.flex": 8 },
    end: { ...STANCE, ...ARMS, "elbow.flex": 128 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.18, -0.2, -0.06], 14, "xz"),
    holdElbowNearShoulder(body, "R", [0.18, -0.2, -0.06], 14, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand with an upright torso and a proud chest, and keep the rest of your body still while the elbows curl.",
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows start straight",
      "Finish the lowering phase with your elbows fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-bent",
      "Elbows finish fully bent",
      "You should finish with your elbows fully bent as your forearms contact your biceps.",
      "elbow_L.flex",
      "bottom",
      105,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows curl the handles up and in",
      "Bend your elbows to curl the handles upward, forward, and in toward each other.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "palms-forward",
      label: "Palms face forward",
      cue: "Step forward while allowing your arms and palms to rotate in line with the resistance from the cables.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -38, "° of forearm pronation"),
    },
  ],
});
