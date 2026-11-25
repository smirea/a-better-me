import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Hinged forward with the back to a low pulley. The working elbow rests against
 * the inner thigh and curls only until the forearm is about parallel to the floor.
 */
const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 42,
  "hip.flex": 58,
  "knee.flex": 38,
  "ankle.dorsi": 8,
  "lumbar.flex": 8,
  "thoracic.flex": 10,
  "neck.flex": -8,
  "hip_L.abd": 16,
  "hip_R.abd": 14,
};

const WORK = {
  "shoulder.elev": 22,
  "shoulder.plane": 48,
  "shoulder.twist": -12,
  "forearm.pron": -74,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

const BRACE = {
  "shoulder.elev": 18,
  "shoulder.plane": 55,
  "shoulder.twist": 6,
  "elbow.flex": 70,
  "forearm.pron": 20,
  "wrist.flex": 4,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "cable-concentration-curl",
  catalogId: "2a05c6f170d880c897bbfc6bb80b7ab3",
  name: "Cable Concentration Curl",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Curl", "Parallel", "Lower", "Hang"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.32, heelZ: 0.12, toeOutDeg: 18, torsoLeanDeg: 42, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.12, 0.22, -0.55],
    columnPos: [0.16, -0.78],
    facingDir: 1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 5, shoulder: 2.2, lumbar: 6, hip: 3, knee: 2 },
  hints: {
    start: sidedHints("L", { ...WORK, "elbow.flex": 10 }, BRACE, HINGE),
    end: sidedHints("L", { ...WORK, "elbow.flex": 92 }, BRACE, HINGE),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.1, -0.26, 0.14], 20, "xyz")],
  checks: () => [
    checkJointWithinAt(
      "hinged",
      "Torso stays inclined",
      "Sit your hips back while allowing your knees to bend and torso to incline further forward until you can rest your elbow against the inside of your thigh.",
      "hip_L.flex",
      "peak",
      40,
      85,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow starts straight",
      "Your working side’s arm should be directed down toward the ground with a straight elbow.",
      "elbow_L.flex",
      "top",
      0,
      26,
    ),
    checkJointWithinAt(
      "forearm-parallel",
      "Curl stops near parallel",
      "You can finish curling once your forearm is approximately parallel to the ground.",
      "elbow_L.flex",
      "bottom",
      70,
      115,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbow curls against the thigh",
      "While keeping your elbow pinned against your inner thigh, bend your elbow to curl the handle forward and upward.",
      "elbow_L.flex",
      55,
    ),
    {
      id: "palm-forward",
      label: "Palm faces forward",
      cue: "Hold the handle with your palm facing forward and your elbow straight.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -42, "° of forearm pronation"),
    },
  ],
});
