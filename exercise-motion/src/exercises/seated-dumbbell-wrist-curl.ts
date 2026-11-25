import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Forearms on the thighs, palms up, dumbbells just past the knees. */
const SETUP = {
  ...POSTURE_HINTS.seated,
  "root.y": 0.52,
  "root.pitch": 28,
  "lumbar.flex": 16,
  "thoracic.flex": 18,
  "neck.flex": 10,
  "hip.flex": 78,
  "knee.flex": 92,
  "shoulder.elev": 40,
  "shoulder.plane": 68,
  "shoulder.twist": -18,
  "elbow.flex": 80,
  "forearm.pron": -78,
  "clavicle.elev": 4,
};

export const spec = buildExerciseSpec({
  id: "seated-dumbbell-wrist-curl",
  catalogId: "1a15c6f170d880198cf6d0da1a319b0e",
  name: "Seated Dumbbell Wrist Curl",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.3, top: 0.2 },
  station: {
    kind: "seated",
    seatY: 0.46,
    stanceX: 0.22,
    heelZ: 0.4,
    leanDeg: 26,
    frame: { type: "flat-bench", zHead: -0.4, zFoot: 0.28 },
  },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...SETUP, "wrist.flex": -40 },
    end: { ...SETUP, "wrist.flex": 52 },
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Wrists curl the dumbbells",
      "Lift the dumbbells by curling your wrists while your forearms stay on your thighs.",
      "wrist_L.flex",
      55,
    ),
    checkJointWithinAt(
      "palms-start-forward",
      "Wrists start extended",
      "Let the dumbbells bend your wrists so your palms face forward.",
      "wrist_L.flex",
      "top",
      -65,
      -12,
    ),
    checkJointWithinAt(
      "palms-finish-back",
      "Wrists finish curled",
      "Finish with your palms angled back toward you.",
      "wrist_L.flex",
      "bottom",
      25,
      70,
    ),
    checkJointWithinAt(
      "elbows-still",
      "Elbows stay bent on the thighs",
      "All motion should come from your wrists.",
      "elbow_L.flex",
      "peak",
      55,
      110,
    ),
  ],
});
