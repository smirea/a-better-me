import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** High incline, about 65° from horizontal: bar on the upper chest, elbows about 45–75° from the torso. */
const BOTTOM = {
  ...POSTURE_HINTS.incline45,
  "root.y": 0.5,
  "root.pitch": -26,
  "hip.flex": 78,
  "hip.abd": 14,
  "knee.flex": 92,
  "ankle.dorsi": 4,
  "lumbar.flex": -8,
  "thoracic.flex": -4,
  "neck.flex": 6,
  "clavicle.prot": -14,
  "clavicle.elev": 4,
  "shoulder.elev": 58,
  "shoulder.plane": 68,
  "shoulder.twist": 22,
  "elbow.flex": 96,
  "forearm.pron": 48,
  "wrist.flex": -6,
};

const LOCKOUT = {
  ...BOTTOM,
  "shoulder.elev": 158,
  "shoulder.plane": 72,
  "shoulder.twist": 6,
  "elbow.flex": 8,
  "clavicle.elev": 16,
  "neck.flex": 2,
};

export const spec = buildExerciseSpec({
  id: "high-incline-barbell-press",
  catalogId: "1a05c6f170d8803c872ecbe964e2f0ef",
  name: "High Incline Barbell Press",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Press", "Lockout", "Lower", "Chest"],
  station: {
    kind: "lying",
    surface: "adjustable-bench",
    face: "up",
    backAngleDeg: 65,
    feetOnFloor: true,
    rack: { hookY: 1.25, safetyY: 0.75 },
  },
  extraContacts: {
    "bench.backPad": { head: 0.09, neck: 0.07, girdle: 0.04 },
  },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.32,
    anchor: "press",
    path: { startY: 1.08, startZ: 0.18, endY: 1.55, endZ: 0.04, arcBulgeZ: 0.035 },
  },
  hints: { start: BOTTOM, end: LOCKOUT },
  stiffness: { elbow: 3, shoulder: 2, lumbar: 6 },
  checks: () => [
    checkFeetPlanted("Drive the feet into the floor and keep the buttocks on the bench."),
    checkJointRange("elbow-rom", "Press from the upper chest", "Lower toward the upper chest, then press until the elbows straighten above the shoulders.", "elbow_L.flex", 65),
    checkJointWithinAt("bottom-elbow", "Elbows bent at the chest", "Descend until the bar nears the upper chest or collarbone.", "elbow_L.flex", "start", 65, 120),
    checkJointWithinAt("lockout-elbow", "Elbows locked out", "Finish with the elbows straight and the bar over the shoulders.", "elbow_L.flex", "peak", -4, 20),
    checkJointWithinAt("lockout-shoulder", "Shoulders flexed at lockout", "Press up the high incline until the shoulders are flexed overhead.", "shoulder_L.elev", "peak", 100, 172),
  ],
});
