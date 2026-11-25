import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

const ARMS = {
  "shoulder.elev": 46,
  "shoulder.plane": 76,
  "shoulder.twist": 40,
  "elbow.flex": 126,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -88,
  "lumbar.flex": 8,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "hip.flex": 58,
  "hip.abd": 10,
  "knee.flex": 98,
  "ankle.dorsi": 8,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.16,
  "root.pitch": -72,
  "lumbar.flex": 16,
  "thoracic.flex": 28,
  "neck.flex": 16,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-crunch-with-hands-on-shoulders",
  catalogId: "1a35c6f170d880509e05ec8dca53930a",
  name: "Bodyweight Crunch With Hands On Shoulders",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Crunch", "Peak", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: true,
    stanceX: 0.16,
    heelZ: 0.36,
    passiveJoints: ["hip", "knee", "ankle", "shoulder", "elbow"],
  },
  apparatus: { kind: "none" },
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "upper-back-curl",
      "Middle back curls the shoulder blades off the floor",
      "Lift your head and shoulder blades up off the ground by curling your middle back.",
      "thoracic.flex",
      14,
    ),
    checkJointWithinAt(
      "low-back-stays-down",
      "Lower back stays on the floor",
      "The lower half of your back should remain in contact with the ground while you only lift up the upper half of your back mildly off the floor.",
      "lumbar.flex",
      "peak",
      0,
      24,
    ),
    checkFeetPlanted(
      "Lie down on your back with your knees bent, as the soles of your feet are flat on the ground, approximately hip width apart.",
    ),
    checkJointWithinAt(
      "arms-crossed",
      "Hands stay on the shoulders",
      "Cross your arms across your chest with bent elbows to position each hand on the front of the opposite shoulder.",
      "elbow_L.flex",
      "peak",
      100,
      145,
    ),
    checkAnchorTravel(
      "shoulder-blades-lift",
      "Shoulder blades lift off the floor",
      "At the end of the lifting phase, your chest should be facing at an angle between forward and upward.",
      "upperBack",
      "y",
      0.04,
    ),
  ],
});
