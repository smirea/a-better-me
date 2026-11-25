import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Same thigh-supported curl. The bottom lets the bells roll toward the fingertips. */
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
  id: "seated-dumbbell-finger-flexion-wrist-curl",
  catalogId: "1a15c6f170d880629cb0e70c9f87e027",
  name: "Seated Dumbbell Finger Flexion Wrist Curl",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Fist", "Lower", "Roll"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.3, top: 0.2 },
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
    start: { ...SETUP, "wrist.flex": -58 },
    end: { ...SETUP, "wrist.flex": 50 },
  },
  checks: () => [
    checkJointRange(
      "wrist-and-finger-curl",
      "Wrists and fingers curl the dumbbells up",
      "Lift the dumbbells by curling your wrists and closing your fingers together.",
      "wrist_L.flex",
      70,
    ),
    checkJointWithinAt(
      "bells-rolled-down",
      "Dumbbells start rolled toward the fingers",
      "Let the dumbbells roll down the fingers so the palms face forward.",
      "wrist_L.flex",
      "top",
      -70,
      -30,
    ),
    checkJointWithinAt(
      "fist-at-top",
      "Hands finish closed and curled",
      "Finish with the palms angled back toward you and the fingers wrapped around the handles.",
      "wrist_L.flex",
      "bottom",
      22,
      70,
    ),
    checkJointWithinAt(
      "forearms-down",
      "Forearms stay on the thighs",
      "Keep your forearms resting on your thighs so only the wrists and fingers move.",
      "elbow_L.flex",
      "start",
      55,
      110,
    ),
  ],
});
