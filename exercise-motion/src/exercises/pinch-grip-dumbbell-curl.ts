import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Each hand pinches the top head of a dumbbell, palm down.
 * Wrist extension keeps the handle lined up with the forearm as the elbow bends.
 */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "shoulder.plane": 42,
  "shoulder.twist": 20,
  "forearm.pron": 76,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "pinch-grip-dumbbell-curl",
  catalogId: "2ab5c6f170d88084bd4cdfcad5daeb82",
  name: "Pinch Grip Dumbbell Curl",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Lower", "Rest"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.7, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  hints: {
    start: { ...TRUNK, "shoulder.elev": 12, "elbow.flex": 8, "wrist.flex": -8 },
    end: { ...TRUNK, "shoulder.elev": 16, "elbow.flex": 130, "wrist.flex": -42 },
  },
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.06, -0.3, 0.06], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.06, -0.3, 0.06], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack("Stand upright in a near hip-width stance with the arms by your sides and the elbows straight."),
    checkJointWithinAt(
      "elbows-extended",
      "Elbows start extended",
      "Stand upright with your arms by your sides and your elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "Curl the dumbbells until the elbows are fully bent and the handles angle upward with the forearms.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    checkJointRange(
      "elbow-rom",
      "Pinch-grip curl",
      "Curl the dumbbells upward by bending the elbows, then lower them until the elbows are straight.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "pronated-pinch",
      label: "Palms stay down in a pinch",
      cue: "Grasp the top end of each dumbbell with the palms directed down, and keep squeezing.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => -deg(angles["forearm_L.pron"]), -50, "° short of a palm-down pinch"),
    },
    checkJointWithinAt(
      "wrists-cocked",
      "Wrists extend to keep the handles with the forearms",
      "When the elbows are bent, cock the wrists back so the handles point with the forearms instead of hanging vertical.",
      "wrist_L.flex",
      "bottom",
      -65,
      -20,
    ),
  ],
});
