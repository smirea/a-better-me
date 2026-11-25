import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { keepAbove } from "../solver";
import { checkAnchorTravel, checkFeetPlanted, checkJointRange } from "../postures";

const DOWN = {
  ...POSTURE_HINTS.supineFloor,
  "root.y": 0.12,
  "root.pitch": -86,
  "lumbar.flex": 8,
  "thoracic.flex": 4,
  "neck.flex": 8,
  "hip.flex": 52,
  "hip.abd": 10,
  "knee.flex": 100,
  "ankle.dorsi": 8,
  "shoulder.elev": 10,
  "shoulder.plane": 40,
  "shoulder.twist": 6,
  "elbow.flex": 10,
  "forearm.pron": 70,
  "wrist.flex": 4,
};

const UP = {
  ...DOWN,
  "root.y": 0.16,
  "root.pitch": -68,
  "lumbar.flex": 36,
  "thoracic.flex": 28,
  "neck.flex": 14,
  "hip.flex": 70,
  "shoulder.elev": 22,
  "shoulder.plane": 70,
  "elbow.flex": 36,
  "wrist.flex": -15,
};

export const spec = buildExerciseSpec({
  id: "bodyweight-sit-up-with-hands-on-floor",
  catalogId: "1a35c6f170d880f3b162c9b459eca0c6",
  name: "Bodyweight Sit-Up With Hands On Floor",
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
    passiveJoints: ["ankle", "clavicle"],
  },
  apparatus: { kind: "none" },
  stiffness: { lumbar: 22, thoracic: 20, hip: 2, root: 2, shoulder: 3 },
  extraGoals: (body) => [
    keepAbove(body, "palmFlat_L", 0.04, 55),
    keepAbove(body, "palmFlat_R", 0.04, 55),
    keepAbove(body, "grip_L", 0.04, 55),
    keepAbove(body, "grip_R", 0.04, 55),
  ],
  hints: { start: DOWN, end: UP },
  checks: () => [
    checkJointRange(
      "trunk-curl",
      "Back rounds as the chest comes toward the thighs",
      "To train your abdominal muscles dynamically, your back should progressively round rather than remain in a flat position.",
      "lumbar.flex",
      14,
    ),
    checkJointRange(
      "full-sit-up",
      "The whole back lifts off the ground",
      "Given that this is a sit-up rather than a crunch, you will lift the entirety of your back off the ground.",
      "thoracic.flex",
      10,
    ),
    checkFeetPlanted(
      "Lie down on your back with your knees bent and the soles of your feet flat on the ground, approximately hip width apart.",
    ),
    checkAnchorTravel(
      "hands-slide",
      "Hands slide forward along the floor",
      "Allow your hands to slide forward on the ground progressively as your torso lifts up.",
      "palmFlat_L",
      "z",
      0.04,
    ),
    checkAnchorTravel(
      "chest-faces-forward",
      "Chest rises to face forward",
      "At the end of the lifting phase, your chest should be facing forward.",
      "sternum",
      "y",
      0.05,
    ),
  ],
});
