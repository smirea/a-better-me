import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Snatch grip, elbows locked, bar stacked over the midfoot. */
const ARMS = {
  "clavicle.elev": 22,
  "clavicle.prot": -6,
  "shoulder.elev": 168,
  "shoulder.plane": 78,
  "shoulder.twist": -30,
  "elbow.flex": 4,
  "forearm.pron": 70,
  "wrist.flex": -18,
  "wrist.dev": 0,
};

const STAND = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "hip.abd": 12,
  "hip.rot": 16,
  "knee.flex": 4,
  "ankle.dorsi": 2,
  ...ARMS,
};

const BOTTOM = {
  "root.y": 0.54,
  "root.z": -0.02,
  "root.pitch": 16,
  "hip.flex": 112,
  "hip.abd": 22,
  "hip.rot": 10,
  "knee.flex": 122,
  "ankle.dorsi": 28,
  "ankle.inv": 2,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 4,
  ...ARMS,
};

export const spec = buildExerciseSpec({
  id: "barbell-overhead-squat",
  catalogId: "1a25c6f170d880feb30bf825a7d3602a",
  name: "Barbell Overhead Squat",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Stand", "Top"],
  station: { kind: "standing", stanceX: 0.2, toeOutDeg: 22, trackKnees: 12, rack: { hookY: 1.38, safetyY: 0.65 } },
  apparatus: { kind: "barbell", gripX: 0.56, anchor: "press", alignWrists: false },
  hints: { start: STAND, end: BOTTOM },
  stiffness: { elbow: 5, shoulder: 3, thoracic: 7 },
  extraGoals: (body) => [
    ({ frame, angles, push }) => {
      const elev = (165 * Math.PI) / 180;
      const elbow = (4 * Math.PI) / 180;
      for (const side of ["L", "R"] as const) {
        const hand = anchorPoint(body, frame, `press_${side}`);
        push(16 * (hand.z - 0.06));
        push(14 * (angles[`shoulder_${side}.elev`] - elev));
        push(12 * (angles[`elbow_${side}.flex`] - elbow));
      }
    },
  ],
  checks: () => [
    checkFlatBack("Keep the torso tall and the back flat; do not round the lumbar spine to chase depth."),
    checkNeutralNeck("Look forward with the neck near neutral rather than craning to watch the bar."),
    checkFeetPlanted("Keep the whole foot planted, heels down, through the bottom of the squat."),
    checkJointRange("knee-depth", "Full overhead squat depth", "Squat to at least parallel while the bar stays locked out overhead.", "knee_L.flex", 90),
    checkJointWithinAt("lockout", "Elbows locked overhead", "Keep the elbows locked and the bar overhead through the descent and the ascent.", "elbow_L.flex", "peak", 0, 16),
    checkJointWithinAt("arms-up", "Bar stays overhead", "Actively press the bar up so the shoulders stay flexed overhead.", "shoulder_L.elev", "peak", 120, 180),
    {
      id: "elbows-locked-throughout",
      label: "Elbows stay locked the whole rep",
      cue: "The elbows stay locked in the snatch grip; bending them dumps the bar forward.",
      evaluate: (context) => everyFrame(context, (_, a) => deg(a["elbow_L.flex"]), 18, "° of elbow flexion"),
    },
  ],
});
