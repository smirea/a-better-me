import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/** Hex-press: palms in, dumbbells squeezed together over the midline. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 84,
  "shoulder.plane": 16,
  "shoulder.twist": 0,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": -2,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 46,
  "shoulder.plane": 6,
  "shoulder.twist": 0,
  "elbow.flex": 100,
  "forearm.pron": 2,
  "wrist.flex": -2,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-squeeze-press",
  catalogId: "35a5c6f170d880f384f9f5b8cc05ed22",
  name: "Dumbbell Squeeze Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Squeeze"],
  tempo: { lower: 2, bottom: 0.3, raise: 1.2, top: 0.45 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "dumbbells",
    anchor: "press",
    handPath: {
      start: [0.13, 1.12, -0.42],
      end: [0.13, 0.9, -0.36],
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
      push(28 * (left.x + right.x));
      push(18 * (Math.abs(left.x) - 0.1));
    },
  ],
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while the dumbbells stay together."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the arms up and the dumbbells still touching over the chest.",
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
    checkJointWithinAt(
      "bottom",
      "Dumbbells lower over the torso",
      "Lower along the midline until the dumbbells are just above the chest.",
      "elbow_L.flex",
      "peak",
      75,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up together",
      "Press the squeezed dumbbells up from the chest.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
