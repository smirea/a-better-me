import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkJointWithinAt } from "../postures";

/** Arms crossed, each hand on the opposite shoulder. */
const ARMS = {
  "shoulder.elev": 48,
  "shoulder.plane": 78,
  "shoulder.twist": 42,
  "elbow.flex": 128,
  "forearm.pron": 20,
  "wrist.flex": 6,
  "clavicle.elev": 4,
};

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -86,
  "lumbar.flex": 8,
  "thoracic.flex": 4,
  "neck.flex": 6,
  "hip.flex": 52,
  "hip.abd": 10,
  "knee.flex": 100,
  "ankle.dorsi": 8,
  ...ARMS,
};

const UP = {
  ...DOWN,
  "root.y": 0.16,
  "root.pitch": -68,
  "lumbar.flex": 36,
  "thoracic.flex": 28,
  "neck.flex": 12,
  "hip.flex": 70,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-sit-up-with-hands-on-shoulders",
  catalogId: "1a35c6f170d880c69859e6c12e048ba9",
  name: "Bodyweight Sit-Up With Hands On Shoulders",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  brace: true,
  phaseLabels: ["Lie", "Curl up", "Sit", "Lower"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    feetOnFloor: true,
    stanceX: 0.16,
    heelZ: 0.42,
    passiveJoints: ["ankle", "clavicle", "shoulder", "elbow", "wrist"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 22, thoracic: 20, hip: 2, root: 2 },
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "Back rounds as the chest comes toward the thighs",
      "To train your abdominal muscles dynamically, your back should progressively round rather than remain in a flat position.",
      "lumbar.flex",
      16,
    ),
    checkJointRange(
      "full-sit-up",
      "The whole back lifts off the ground",
      "Given that this is a sit-up rather than a crunch, you will lift the entirety of your back off the ground.",
      "thoracic.flex",
      12,
    ),
    checkFeetPlanted(
      "Lie down on your back with your knees bent and the soles of your feet flat on the ground, approximately hip width apart.",
    ),
    checkJointWithinAt(
      "arms-crossed",
      "Hands stay on the shoulders",
      "Cross your arms across your chest with bent elbows to position each hand on the front of the opposite shoulder, and maintain this arm position throughout your set.",
      "elbow_L.flex",
      "peak",
      100,
      145,
    ),
    checkAnchorTravel(
      "chest-faces-forward",
      "Chest rises to face forward",
      "At the end of the lifting phase, your chest should be facing forward.",
      "sternum",
      "y",
      0.06,
    ),
  ],
});
