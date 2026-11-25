import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";
import { box } from "../equipment";

const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -18,
  "clavicle.elev": -2,
  
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 72,
  "shoulder.twist": 34,
  "elbow.flex": 6,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 56,
  "shoulder.plane": 8,
  "shoulder.twist": 12,
  "elbow.flex": 88,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "one-board-press",
  catalogId: "24b5c6f170d88089aa60dc0fdfa4478a",
  name: "One-Board Press",
  defaultLoadKg: 42,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Board"],
  tempo: { lower: 1.6, bottom: 0.35, raise: 1, top: 0.45 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
    rack: {  },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.34,
    anchor: "press",
    path: { startY: 1.12, startZ: -0.46, endY: 0.8, endZ: -0.28, arcBulgeZ: 0.04 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5, knee: 3 },
  extraEquipment: [box("board.one", [0, 0.7, -0.28], [0.24, 0.038, 0.14], "wood")],
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor while you press."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straightened and the bar over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      22,
    ),
    checkJointWithinAt(
      "bottom",
      "Bar meets the one-board",
      "Stop on a board about 1.5 inches thick on the lower-to-middle chest.",
      "elbow_L.flex",
      "peak",
      65,
      110,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up",
      "Press the bar up from the bottom of the rep.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
