import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TABLETOP = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.13,
  "root.pitch": -88,
  "lumbar.flex": -6,
  "thoracic.flex": -2,
  "neck.flex": 4,
  "hip.abd": 8,
  "ankle.dorsi": 0,
  "shoulder.twist": 6,
  "forearm.pron": 0,
  "elbow.flex": 4,
  "wrist.flex": 0,
};

const START = {
  ...TABLETOP,
  "hip.flex": 92,
  "knee.flex": 92,
  "shoulder.elev": 92,
  "shoulder.plane": 88,
};

const REACH = {
  ...TABLETOP,
  "hip.flex": 14,
  "knee.flex": 8,
  "shoulder.elev": 164,
  "shoulder.plane": 80,
  "elbow.flex": 6,
};

export const spec = buildExerciseSpec({
  id: "two-arms-two-legs-neutral-dead-bug",
  catalogId: "2b05c6f170d8807b8776cdfc9f03c27b",
  name: "Two-Arms Two-Legs Neutral Dead Bug",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Tabletop", "Reach", "Long", "Return"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: false,
    passiveJoints: ["ankle", "neck", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 22, thoracic: 16, hip: 2.4, shoulder: 1.6 },
  hints: { start: START, end: REACH },
  checks: () => [
    checkFlatBack(
      "Throughout the entire exercise, rigidly maintain the mild curvature of your lower back. All the movement should occur from your shoulders, hips, and knees.",
      8,
    ),
    checkJointRange(
      "arms-sweep",
      "Both arms sweep back toward the floor",
      "Sweep both arms backward and downward while keeping the elbows straight.",
      "shoulder_L.elev",
      48,
    ),
    checkJointRange(
      "legs-reach",
      "Both legs reach long toward the floor",
      "Straighten both legs and lower them toward the ground at the same rate as the arms.",
      "hip_L.flex",
      48,
    ),
    checkJointWithinAt(
      "neutral-arch-holds",
      "Lower back keeps its natural arch",
      "Your lower back should stay near the natural mild curvature you have when standing, rather than arching further as the limbs lower.",
      "lumbar.flex",
      "peak",
      -18,
      8,
    ),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Keep your elbows straight as the arms travel from stacked over the shoulders to beside the floor.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
  ],
});
