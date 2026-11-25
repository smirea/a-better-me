import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { checkAnchorTravel, checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const GOBLET = {
  "shoulder.elev": 46,
  "shoulder.plane": 70,
  "shoulder.twist": 18,
  "elbow.flex": 110,
  "forearm.pron": -48,
  "wrist.flex": 8,
  "clavicle.elev": 6,
};

const UP = {
  ...POSTURE_HINTS.standing,
  "root.x": 0,
  "root.pitch": 4,
  "hip.flex": 12,
  "hip.abd": 16,
  "knee.flex": 12,
  "ankle.dorsi": 4,
  "lumbar.flex": 2,
  "thoracic.flex": 0,
  "neck.flex": 2,
  ...GOBLET,
};

const DOWN = sidedHints(
  "L",
  { "hip.flex": 100, "hip.abd": 32, "hip.rot": 8, "knee.flex": 110, "ankle.dorsi": 24 },
  { "hip.flex": 18, "hip.abd": 8, "hip.rot": 2, "knee.flex": 6, "ankle.dorsi": 2 },
  {
    ...POSTURE_HINTS.standing,
    "root.x": 0.32,
    "root.y": 0.58,
    "root.z": -0.06,
    "root.pitch": 28,
    "lumbar.flex": 6,
    "thoracic.flex": 4,
    "neck.flex": 8,
    ...GOBLET,
  },
);

export const spec = buildExerciseSpec({
  id: "goblet-lateral-lunge",
  catalogId: "1a25c6f170d8803c85d2d91f4fda839f",
  name: "Goblet Lateral Lunge",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Shift", "Bottom", "Drive", "Stand"],
  station: { kind: "standing", stanceX: 0.44, toeOutDeg: 6, trackKnees: 10 },
  apparatus: { kind: "kettlebells", twoHandsOnOne: true },
  hints: { start: UP, end: DOWN },
  progress: (body, frame) => anchorPoint(body, frame, "pelvisBottom").y,
  checks: () => [
    checkFlatBack(
      "Keep your back near a neutral position, like when you are normally standing upright, rather than excessively rounding your lower back.",
    ),
    checkFeetPlanted("Keep the entirety of the soles of both feet in contact with the ground."),
    checkJointRange(
      "step-knee",
      "Stepping knee bends deeply",
      "Bend at that side’s knee and hip while sitting your buttock somewhat backward.",
      "knee_L.flex",
      50,
    ),
    checkJointWithinAt(
      "trail-knee",
      "Other knee stays nearly straight",
      "Squat down with your stepping leg while keeping your other knee straight.",
      "knee_R.flex",
      "bottom",
      0,
      25,
    ),
    checkJointWithinAt(
      "goblet",
      "Goblet stays at the chest",
      "You will continue holding the weight close to your chest in the goblet position throughout your set.",
      "elbow_L.flex",
      "bottom",
      85,
      140,
    ),
    checkAnchorTravel(
      "shift",
      "Hips shift over the stepping leg",
      "While you step to the side, your torso will shift over to that side.",
      "pelvisBottom",
      "x",
      0.12,
    ),
  ],
});
