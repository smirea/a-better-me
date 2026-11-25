import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Facing away from two close hip-height pulleys. Both arms hang back about 45°. */
const ARMS = {
  "shoulder.elev": 44,
  "shoulder.plane": -52,
  "shoulder.twist": -16,
  "forearm.pron": -74,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -8,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 10,
  "knee.flex": 14,
  "hip.flex": 12,
  "thoracic.flex": -2,
};

export const spec = buildExerciseSpec({
  id: "dual-cable-bayesian-curl",
  catalogId: "2aa5c6f170d8806bb424dfab5c233b4b",
  name: "Dual Cable Bayesian Curl",
  defaultLoadKg: 1.5,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.35 },
  station: { kind: "standing", stanceX: 0.24, heelZ: -0.1, toeOutDeg: 10, torsoLeanDeg: 10, balanceZ: false },
  apparatus: {
    kind: "cable-dual",
    pulleyY: 0.92,
    halfWidth: 0.48,
    z: -0.78,
    attachment: "d-handle",
  },
  stiffness: { elbow: 5, shoulder: 2.6, lumbar: 9 },
  hints: {
    start: { ...STANCE, ...ARMS, "elbow.flex": 8 },
    end: { ...STANCE, ...ARMS, "elbow.flex": 128 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.12, -0.2, -0.16], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.12, -0.2, -0.16], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand with an upright torso and a proud chest. The elbows stay behind the torso while you curl.",
    ),
    checkJointWithinAt(
      "arms-behind",
      "Upper arms stay behind the torso",
      "Allow the resistance from the cables to pull your arms backward with straight elbows.",
      "shoulder_L.plane",
      "peak",
      -85,
      -28,
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
      "Elbows curl with the arms lengthened",
      "Bend your elbows to curl the handles forward and upward in an arcing manner.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "palms-forward",
      label: "Palms face forward",
      cue: "Walk forward with your palms facing forward and wrists straight.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
