import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** Hip-height cable at the side. The straight arm angles down and out, then curls toward the shoulder. */
const OUT = {
  "shoulder.elev": 48,
  "shoulder.plane": 16,
  "shoulder.twist": -28,
  "forearm.pron": -72,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": -4,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 34,
  "elbow.flex": 16,
  "forearm.pron": 8,
  "clavicle.elev": 2,
};

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 8,
  "thoracic.flex": -2,
};

export const spec = buildExerciseSpec({
  id: "single-arm-cable-biceps-curl-elbow-out",
  catalogId: "2ab5c6f170d8805e876ad553c17942b3",
  name: "Single Arm Cable Biceps Curl (Elbow-Out)",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Shoulder", "Lower", "Out"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.26, heelZ: 0.04, toeOutDeg: 10, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.72, 0.95, 0.06],
    columnPos: [0.88, 0.16],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 12, shoulder: 2.6, lumbar: 9 },
  hints: {
    start: sidedHints("L", { ...OUT, "elbow.flex": 8 }, REST, STANCE),
    end: sidedHints("L", { ...OUT, "elbow.flex": 128 }, REST, STANCE),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.2, -0.12, 0.04], 16, "xyz")],
  checks: () => [
    checkFlatBack(
      "Stand with an upright torso and a proud chest. Your shoulders stay level and your chest faces the same way as your belt buckle.",
    ),
    checkJointWithinAt(
      "elbow-out",
      "Upper arm stays angled out",
      "Allow the cable’s resistance to lift your arm out to the side with a straight elbow.",
      "shoulder_L.elev",
      "peak",
      32,
      70,
    ),
    checkJointWithinAt(
      "no-twist",
      "Chest stays square",
      "Your chest is facing the same direction as your imaginary belt buckle, rather than being twisted toward the pulley.",
      "thoracic.twist",
      "peak",
      -10,
      10,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow starts straight",
      "Finish this step with your elbow fully straightened.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbow-bent",
      "Elbow finishes fully bent",
      "You should finish with your elbow fully bent as your forearm is contacting your biceps.",
      "elbow_L.flex",
      "bottom",
      100,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Curl toward the shoulder",
      "Bend your elbow to curl the handle in toward your shoulder while keeping your upper arm stationary.",
      "elbow_L.flex",
      85,
    ),
    {
      id: "palm-forward",
      label: "Palm directed forward",
      cue: "With your palm directed forward, take a step out to the side away from the pulley.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
