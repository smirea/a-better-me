import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { exerciseMat } from "../equipment-library";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothToes } from "../postures";
import { keepAbove } from "../solver";

/**
 * High plank on two dumbbells. One arm rows the bell to the ribcage while the other
 * stays straight and bears weight on its dumbbell. The rep alternates sides.
 */
const PLANK = {
  ...POSTURE_HINTS.pronePlank,
  "root.y": 0.64,
  "root.pitch": 82,
  "lumbar.flex": 8,
  "thoracic.flex": 4,
  "thoracic.twist": 0,
  "neck.flex": 2,
  "hip.abd": 8,
  "hip.flex": 4,
  "knee.flex": 4,
  "ankle.dorsi": 8,
};

const SUPPORT_ARM = {
  "shoulder.elev": 78,
  "shoulder.plane": 82,
  "shoulder.twist": 8,
  "elbow.flex": 8,
  "forearm.pron": 70,
  "wrist.flex": 8,
  "clavicle.prot": 8,
  "clavicle.elev": 4,
};

const ROW_ARM = {
  "shoulder.elev": 48,
  "shoulder.plane": 58,
  "shoulder.twist": 6,
  "elbow.flex": 96,
  "forearm.pron": 40,
  "wrist.flex": 6,
  "clavicle.prot": -8,
  "clavicle.elev": 6,
};

const START = { ...PLANK, ...SUPPORT_ARM };

export const spec = buildExerciseSpec({
  id: "dumbbell-renegade-row",
  catalogId: "3065c6f170d880d2bc77cba9edbf8ce9",
  name: "Dumbbell Renegade Row",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "alternating",
  grip: "hang",
  brace: true,
  phaseLabels: ["Plank", "Row", "Switch", "Row"],
  station: { kind: "cardio", machine: "none" },
  extraEquipment: exerciseMat(0.9, 2.0, -0.05),
  ground: "ballIn_L",
  extraGoals: (body) => [
    ...plantBothToes(body, 0.14, -0.78, 0.055, 60),
    keepAbove(body, "grip_L", 0.11, 70),
    keepAbove(body, "grip_R", 0.11, 70),
  ],
  extraRequired: [
    { label: "Left forefoot grounded", anchor: "ballIn_L", surfaceY: 0.055, allowSlide: true },
    { label: "Right forefoot grounded", anchor: "ballIn_R", surfaceY: 0.055, allowSlide: true },
  ],
  stiffness: { hip: 8, lumbar: 14, thoracic: 12, shoulder: 6, elbow: 5 },
  apparatus: {
    kind: "dumbbells",
    sides: ["L", "R"],
  },
  hints: {
    start: START,
    end: sidedHints("L", ROW_ARM, SUPPORT_ARM, PLANK),
  },
  checks: () => [
    checkFlatBack(
      "Keep a rigid plank. Squeeze your glutes and brace your abs so the hips do not sag or pike.",
      12,
    ),
    checkNeutralNeck("Keep your neck in line with your spine, looking at the floor a short way ahead."),
    checkJointRange(
      "row",
      "One dumbbell rows to the ribcage",
      "Row one dumbbell up toward your ribcage with the elbow tucked, while the other arm stays straight on its dumbbell.",
      "elbow_L.flex",
      55,
    ),
    checkJointWithinAt(
      "support-arm",
      "The opposite arm stays straight",
      "Keep the supporting elbow straight and that hand planted on its dumbbell.",
      "elbow_R.flex",
      "peak",
      0,
      28,
    ),
    checkJointWithinAt(
      "tucked",
      "Working elbow stays near the ribs",
      "Pull the working dumbbell toward the ribcage with the elbow tucked, not flared into a rear-delt fly.",
      "shoulder_L.plane",
      "peak",
      42,
      70,
    ),
  ],
});
