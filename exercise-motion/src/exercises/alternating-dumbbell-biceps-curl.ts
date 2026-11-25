import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = POSTURE_HINTS.standing;

const REST_ARM = {
  "shoulder.elev": 12,
  "shoulder.plane": 46,
  "shoulder.twist": 2,
  "elbow.flex": 8,
  "forearm.pron": 2,
  "wrist.flex": 2,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

const CURLED_ARM = {
  "shoulder.elev": 16,
  "shoulder.plane": 52,
  "shoulder.twist": -18,
  "elbow.flex": 136,
  "forearm.pron": -80,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "alternating-dumbbell-biceps-curl",
  catalogId: "1a15c6f170d880bc94aeee97f3ba0721",
  name: "Alternating Dumbbell Biceps Curl",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "alternating",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Switch", "Other"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.3, top: 0.25 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", sides: ["L", "R"] },
  hints: {
    start: { ...TRUNK, ...REST_ARM },
    end: sidedHints("L", CURLED_ARM, REST_ARM, TRUNK),
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.045, -0.3, 0.05], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.045, -0.3, 0.05], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Pick up a pair of dumbbells and stand upright with approximately a hip-width stance while holding the dumbbells at your sides with extended elbows.",
    ),
    checkJointWithinAt(
      "start-neutral",
      "Both arms start extended in a neutral grip",
      "Direct your palms so that they are facing in toward your sides.",
      "forearm_L.pron",
      "top",
      -22,
      22,
    ),
    checkJointWithinAt(
      "start-extended",
      "Elbows start extended",
      "Stand upright while holding the dumbbells at your sides with extended elbows.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "left-peak-flex",
      "Working elbow fully flexes",
      "Curl the other dumbbell upward by bending at your elbow.",
      "elbow_L.flex",
      "bottom",
      115,
      150,
    ),
    checkJointWithinAt(
      "left-peak-supinated",
      "Forearm rotates to an underhand grip at the peak",
      "While curling the dumbbell upward, simultaneously rotate your forearm into an underhand grip position.",
      "forearm_L.pron",
      "bottom",
      -90,
      -50,
    ),
    checkJointWithinAt(
      "resting-arm-extended",
      "The other dumbbell stays at the side",
      "Keep one dumbbell resting at your side with an extended elbow.",
      "elbow_R.flex",
      "bottom",
      0,
      28,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "After your elbow has fully flexed, reverse the motion until your elbow has returned to an extended position.",
      "elbow_L.flex",
      95,
    ),
  ],
});
