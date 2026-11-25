import { Vector3 } from "three";
import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantToe } from "../solver";

/** Inside knee down, low side pulley. The elbow stays out and the hand curls across toward the far shoulder. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.72,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": 2,
  "hip_R.flex": 92,
  "hip_R.abd": 6,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 20,
  "hip_L.abd": 6,
  "knee_L.flex": 102,
  "ankle_L.dorsi": 8,
};

const OUT = {
  "shoulder.elev": 42,
  "shoulder.plane": 28,
  "shoulder.twist": -22,
  "forearm.pron": -70,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": -2,
};

const BRACE = {
  "shoulder.elev": 24,
  "shoulder.plane": 68,
  "shoulder.twist": 4,
  "elbow.flex": 88,
  "forearm.pron": 12,
  "wrist.flex": 6,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "half-kneeling-single-arm-cable-biceps-curl-elbow-out",
  catalogId: "2ab5c6f170d880958085ee307ac4263c",
  name: "Half-Kneeling Single Arm Cable Biceps Curl (Elbow-Out)",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Across", "Lower", "Out"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 2 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.78, 0.48, -0.05],
    columnPos: [0.95, 0.05],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 14, shoulder: 2.8, lumbar: 12, thoracic: 10, knee: 5 },
  hints: {
    start: sidedHints("L", { ...OUT, "elbow.flex": 8 }, BRACE, LEGS),
    end: sidedHints("L", { ...OUT, "elbow.flex": 126 }, BRACE, LEGS),
  },
  extraGoals: (body) => [
    ...plantToe(body, "L", new Vector3(0.14, 0.06, -0.5), 0, 90),
    holdElbowNearShoulder(body, "L", [0.18, -0.08, 0.06], 14, "xyz"),
  ],
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "elbow_L.flex", 126, 32)],
  }),
  checks: () => [
    checkJointWithinAt(
      "down-knee",
      "Inside knee stays down",
      "Step back with your leg closer to the cable and rest its knee on the ground.",
      "knee_L.flex",
      "bottom",
      75,
      125,
    ),
    checkJointWithinAt(
      "square-chest",
      "Chest stays square to the belt buckle",
      "Your shoulders should be level as your chest is facing the same direction as your imaginary belt buckle.",
      "thoracic.twist",
      "peak",
      -12,
      12,
    ),
    checkJointWithinAt(
      "elbow-out",
      "Upper arm stays angled out",
      "Allow the cable’s resistance to lift your arm out to the side with a straight elbow.",
      "shoulder_L.elev",
      "peak",
      26,
      68,
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
      "Bend your elbow to curl the handle across your body toward your opposite shoulder.",
      "elbow_L.flex",
      "bottom",
      85,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Cross-body elbow curl",
      "Bend your elbow to curl the handle across your body toward your opposite shoulder while keeping your upper arm stationary.",
      "elbow_L.flex",
      80,
    ),
    {
      id: "palm-forward",
      label: "Palm directed forward",
      cue: "Direct your working palm forward and keep your wrist mostly straight.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -38, "° of forearm pronation"),
    },
  ],
});
