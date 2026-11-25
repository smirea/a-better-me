import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange, checkNeutralNeck } from "../postures";

const ARMS = {
  "shoulder.elev": 62,
  "shoulder.plane": 58,
  "shoulder.twist": 30,
  "elbow.flex": 120,
  "forearm.pron": -15,
  "wrist.flex": 8,
  "clavicle.elev": 4,
};

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -86,
  "lumbar.flex": 6,
  "thoracic.flex": 2,
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
  id: "bodyweight-sit-up-with-hands-behind-head",
  catalogId: "1a35c6f170d8800db688c4776155d095",
  name: "Bodyweight Sit-Up With Hands Behind Head",
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
    checkJointRange(
      "hip-flexion",
      "Hips flex as the torso rises",
      "Bring your chest toward your thighs as you tighten your abdominal muscles.",
      "hip_L.flex",
      8,
    ),
    checkFeetPlanted(
      "Lie down on your back with your knees bent and the soles of your feet flat on the ground, approximately hip width apart.",
    ),
    checkNeutralNeck(
      "Your neck should be near a neutral position. Keep your hands relaxed rather than pulling your head.",
      28,
    ),
    checkAnchorTravel(
      "chest-rises",
      "Chest rises off the floor",
      "At the end of the lifting phase, your chest should be facing forward.",
      "sternum",
      "y",
      0.06,
    ),
  ],
});
