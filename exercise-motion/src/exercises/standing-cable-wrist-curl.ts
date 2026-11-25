import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Elbows held near 90 degrees so the forearms stay level, underhand. */
const ARMS = {
  ...POSTURE_HINTS.standing,
  "shoulder.elev": 18,
  "shoulder.plane": 55,
  "shoulder.twist": -14,
  "elbow.flex": 92,
  "forearm.pron": -76,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "standing-cable-wrist-curl",
  catalogId: "2e85c6f170d880ce885bfab5208e6986",
  name: "Standing Cable Wrist Curl",
  defaultLoadKg: 6,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Stretch"],
  tempo: { lower: 1.2, bottom: 0.22, raise: 1.3, top: 0.2 },
  station: { kind: "standing", stanceX: 0.16, balanceZ: 0.1 },
  apparatus: {
    kind: "cable-single",
    pulley: [0, 0.28, 0.72],
    columnPos: [0, 0.9],
    facingDir: -1,
    attachment: "straight-bar",
    gripX: 0.18,
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.08, -0.28, 0.05], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.08, -0.28, 0.05], 16, "xz"),
  ],
  hints: {
    start: { ...ARMS, "wrist.flex": -40 },
    end: { ...ARMS, "wrist.flex": 50 },
  },
  checks: () => [
    checkJointRange(
      "wrist-curl",
      "Wrists curl the bar",
      "Curl your wrists so your palms angle back toward you and your knuckles rise above your wrists.",
      "wrist_L.flex",
      55,
    ),
    checkJointWithinAt(
      "elbows-fixed",
      "Elbows stay bent about 90 degrees",
      "Keep your forearms parallel to the ground with a static bend at the elbows.",
      "elbow_L.flex",
      "start",
      70,
      115,
    ),
    checkJointWithinAt(
      "underhand",
      "Underhand grip",
      "Grasp the bar with your palms facing forward.",
      "forearm_L.pron",
      "start",
      -90,
      -45,
    ),
    checkJointWithinAt(
      "stretch",
      "Wrists start extended",
      "Let the cable angle your palms forward so your knuckles sit below your wrists.",
      "wrist_L.flex",
      "top",
      -65,
      -12,
    ),
  ],
});
