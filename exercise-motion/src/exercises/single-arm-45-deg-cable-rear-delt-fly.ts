import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/** High pulley on the free side. The working arm sweeps down and back on a diagonal. */
const STANCE = {
  ...POSTURE_HINTS.standing,
  "root.z": -0.08,
  "root.x": 0.08,
  "knee.flex": 8,
  "hip.flex": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
};

const REACH = {
  "shoulder.elev": 96,
  "shoulder.plane": 86,
  "shoulder.twist": 6,
  "elbow.flex": 20,
  "forearm.pron": 18,
  "wrist.flex": 0,
  "clavicle.elev": 12,
  "clavicle.prot": 6,
};

const SWEEP = {
  "shoulder.elev": 58,
  "shoulder.plane": 6,
  "shoulder.twist": 4,
  "elbow.flex": 18,
  "forearm.pron": 16,
  "wrist.flex": 0,
  "clavicle.elev": 6,
  "clavicle.prot": -10,
};

const FREE = {
  "shoulder.elev": 18,
  "shoulder.plane": 24,
  "elbow.flex": 16,
  "forearm.pron": 10,
  "clavicle.elev": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "single-arm-45-deg-cable-rear-delt-fly",
  catalogId: "2a05c6f170d88001926dfd6fada02197",
  name: "Single Arm 45° Cable Rear Delt Fly",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Sweep", "Low", "Return", "High"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "cable-single",
    pulley: [-0.72, 1.58, 0.28],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 6, shoulder: 2.2, lumbar: 9 },
  hints: {
    start: sidedHints("L", REACH, FREE, STANCE),
    end: sidedHints("L", SWEEP, FREE, STANCE),
  },
  checks: () => [
    checkFlatBack(
      "Keep the torso upright and the chest facing forward. Do not twist toward the pulley.",
    ),
    checkJointWithinAt(
      "high-reach",
      "Arm starts high across the body",
      "Reach across the body toward the high pulley with a slightly bent elbow.",
      "shoulder_L.elev",
      "start",
      75,
      125,
    ),
    checkJointWithinAt(
      "diagonal-finish",
      "Arm finishes out and down",
      "Sweep the arm diagonally downward and backward until the elbow is about level with the shoulder or slightly behind it.",
      "shoulder_L.plane",
      "peak",
      -20,
      30,
    ),
    checkJointWithinAt(
      "soft-elbow",
      "Elbow stays slightly bent",
      "Keep the working elbow slightly bent from the setup onward.",
      "elbow_L.flex",
      "peak",
      6,
      40,
    ),
    checkJointRange(
      "high-to-low",
      "Arm travels down the diagonal",
      "Balance the sweep between horizontally outward and vertically downward.",
      "shoulder_L.elev",
      25,
    ),
  ],
});
