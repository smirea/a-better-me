import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/** Grip near twice shoulder width. Elbows flare more than a standard bench press. */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 90,
  "shoulder.plane": 82,
  "shoulder.twist": 34,
  "elbow.flex": 8,
  "forearm.pron": 26,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 58,
  "shoulder.plane": -16,
  "shoulder.twist": 12,
  "elbow.flex": 98,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "wide-grip-smith-machine-bench-press",
  catalogId: "2305c6f170d8802492b1d3682e0381dc",
  name: "Wide Grip Smith Machine Bench Press",
  defaultLoadKg: 36,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "flat-bench",
    face: "up",
    stanceX: 0.2,
    heelZ: 0.42,
    feetOnFloor: true,
    smith: { stopY: 0.55 },
  },
  apparatus: {
    kind: "barbell",
    gripX: 0.46,
    anchor: "press",
    path: { startY: 0.96, startZ: -0.2, endY: 0.7, endZ: -0.16 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5 },
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
      "wide-bottom",
      "Wide grip on the chest",
      "A wide grip flares the elbows more and stops a little short of a close-grip depth.",
      "elbow_L.flex",
      "peak",
      75,
      120,
    ),
    checkAnchorTravel(
      "bar-rises",
      "Bar travels up the rails",
      "Press the bar up from the chest.",
      "press_L",
      "y",
      0.16,
    ),
  ],
});
