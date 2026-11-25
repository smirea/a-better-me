import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.62,
  "root.z": -0.18,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 10,
  "clavicle.prot": -16,
  "clavicle.elev": 2,
};

const ARMS_TOP = {
  "shoulder.elev": 100,
  "shoulder.plane": 32,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": -2,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": 8,
  "shoulder.twist": 0,
  "elbow.flex": 100,
  "forearm.pron": 2,
  "wrist.flex": -2,
};

export const spec = buildExerciseSpec({
  id: "incline-dumbbell-squeeze-press",
  catalogId: "35a5c6f170d880acb738d138ac06c557",
  name: "Incline Dumbbell Squeeze Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Squeeze"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.2, top: 0.45 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 45,
    stanceX: 0.2,
    heelZ: 0.48,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "dumbbells",
    anchor: "press",
    handPath: {
      start: [0.14, 1.4, -0.08],
      end: [0.14, 1.08, 0.02],
    },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.55, elbow: 3, forearm: 3, lumbar: 5, thoracic: 5, clavicle: 3.5 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const left = anchorPoint(body, frame, "press_L");
      const right = anchorPoint(body, frame, "press_R");
      push(26 * (left.x + right.x));
      push(16 * (Math.abs(left.x) - 0.1));
    },
  ],
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while the dumbbells stay together."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the arms up the incline and the dumbbells still touching.",
      "elbow_L.flex",
      "start",
      0,
      40,
    ),
    checkJointWithinAt(
      "neutral-grip",
      "Palms stay facing each other",
      "Squeeze the dumbbells together with a neutral grip.",
      "forearm_L.pron",
      "peak",
      -20,
      24,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up together",
      "Press the squeezed dumbbells up from the upper chest.",
      "press_L",
      "y",
      0.12,
    ),
  ],
});
