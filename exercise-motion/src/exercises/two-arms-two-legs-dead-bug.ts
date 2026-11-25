import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TABLETOP = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.13,
  "root.pitch": -88,
  "lumbar.flex": 10,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "hip.abd": 8,
  "ankle.dorsi": 0,
  "shoulder.twist": 8,
  "forearm.pron": 0,
  "elbow.flex": 4,
  "wrist.flex": 0,
};

/** Arms stacked over the shoulders, both knees stacked over the hips. */
const START = {
  ...TABLETOP,
  "hip.flex": 92,
  "knee.flex": 92,
  "shoulder.elev": 92,
  "shoulder.plane": 88,
};

/** Both arms sweep overhead while both legs reach long toward the floor. */
const EXTENDED = {
  ...TABLETOP,
  "hip.flex": 16,
  "knee.flex": 8,
  "shoulder.elev": 168,
  "shoulder.plane": 82,
  "elbow.flex": 6,
  "lumbar.flex": 10,
  "thoracic.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "two-arms-two-legs-dead-bug",
  catalogId: "2a25c6f170d880e993b3f026d67b74c1",
  name: "Two-Arms Two-Legs Dead Bug",
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
  hints: { start: START, end: EXTENDED },
  checks: () => [
    checkFlatBack(
      "Press your lower back lightly into the floor to flatten it, and continue doing so throughout your set. All the movement should occur from your shoulders, hips, and knees as your spine remains motionless.",
      8,
    ),
    checkJointRange(
      "arms-sweep",
      "Both arms sweep back toward the floor",
      "Sweep both arms backward and downward while keeping the elbows straight.",
      "shoulder_L.elev",
      50,
    ),
    checkJointRange(
      "legs-reach",
      "Both legs reach long toward the floor",
      "Straighten both legs and lower them toward the ground together, moving the arms and legs at the same rate.",
      "hip_L.flex",
      50,
    ),
    checkJointRange(
      "knees-straighten",
      "Both knees straighten as the legs lower",
      "While keeping your elbows straight, straighten your legs as you lower them, then bend the knees back to about 90 degrees at the top.",
      "knee_L.flex",
      55,
    ),
    checkJointWithinAt(
      "knees-stacked",
      "Knees start stacked over the hips",
      "At the top, both knees should be stacked vertically above the hips, with the arms vertically stacked above the shoulders.",
      "knee_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "low-back-flat",
      "Lower back stays pressed into the floor",
      "Brace your core so you cannot slide a hand under your lower back as the arms and legs reach long.",
      "lumbar.flex",
      "peak",
      0,
      22,
    ),
  ],
});
