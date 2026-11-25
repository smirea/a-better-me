import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointWithinAt } from "../postures";

/**
 * About 10° of decline. Feet stay on the floor. The bench builder adds ankle
 * rollers for any negative back angle, so the angle stays mild enough that the
 * feet can still plant in front of them.
 */
const TRUNK = {
  ...POSTURE_HINTS.supineFlat,
  "root.pitch": -86,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.flex": 28,
  "hip.abd": 12,
  "knee.flex": 92,
  "ankle.dorsi": 2,
  "clavicle.prot": -16,
  "clavicle.elev": -2,
};

const ARMS_TOP = {
  "shoulder.elev": 92,
  "shoulder.plane": 70,
  "shoulder.twist": 30,
  "elbow.flex": 6,
  "forearm.pron": 28,
  "wrist.flex": -6,
};

const ARMS_BOTTOM = {
  "shoulder.elev": 54,
  "shoulder.plane": 6,
  "shoulder.twist": 12,
  "elbow.flex": 110,
  "forearm.pron": 36,
  "wrist.flex": -8,
};

export const spec = buildExerciseSpec({
  id: "slight-decline-dumbbell-bench-press",
  catalogId: "2535c6f170d8801bab2af2748abfe4e1",
  name: "Slight Decline Dumbbell Bench Press",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Lower chest"],
  tempo: { lower: 2, bottom: 0.25, raise: 1.2, top: 0.5 },
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: -10,
    stanceX: 0.22,
    heelZ: 0.58,
    feetOnFloor: true,
  },
  apparatus: {
    kind: "dumbbells",
    anchor: "press",
    handPath: { start: [0.3, 1.05, -0.48], end: [0.32, 0.78, -0.36] },
  },
  extraContacts: {
    "bench.seatPad": {
      thigh_L: 0.07,
      thigh_R: 0.07,
      thighShaft_L: 0.07,
      thighShaft_R: 0.07,
      pelvis: 0.05,
    },
    "bench.rollerLow": { shank_L: 0.12, shank_R: 0.12, foot_L: 0.06, foot_R: 0.06 },
    "bench.rollerTop": { shank_L: 0.1, shank_R: 0.1 },
  },
  hints: {
    start: { ...TRUNK, ...ARMS_TOP },
    end: { ...TRUNK, ...ARMS_BOTTOM },
  },
  stiffness: { shoulder: 0.7, elbow: 4, lumbar: 5, thoracic: 5, clavicle: 3.5, hip: 1.4, knee: 1.4 },
  checks: () => [
    checkFeetPlanted("Keep both feet flat on the floor on this mild decline."),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows locked out",
      "Finish with the elbows straightened and the dumbbells over the shoulders.",
      "elbow_L.flex",
      "start",
      0,
      36,
    ),
    checkJointWithinAt(
      "bottom",
      "Dumbbells meet the lower chest",
      "A slight decline, about 10 degrees, lowers toward the lower chest.",
      "elbow_L.flex",
      "peak",
      85,
      130,
    ),
    checkAnchorTravel(
      "dumbbells-rise",
      "Dumbbells travel up",
      "Press the dumbbells up from the bottom of the rep.",
      "press_L",
      "y",
      0.14,
    ),
  ],
});
