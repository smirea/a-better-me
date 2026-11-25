import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = POSTURE_HINTS.standing;

const REST_ARM = {
  "shoulder.elev": 12,
  "shoulder.plane": 40,
  "shoulder.twist": 4,
  "elbow.flex": 8,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
};

/** Hammer curl across the torso toward the opposite shoulder. Upper arm comes slightly forward. */
const CROSS = {
  "shoulder.elev": 28,
  "shoulder.plane": 18,
  "shoulder.twist": 22,
  "elbow.flex": 132,
  "forearm.pron": 2,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 6,
};

export const spec = buildExerciseSpec({
  id: "alternating-cross-body-dumbbell-hammer-curl",
  catalogId: "1a15c6f170d880f59d33ed81d1f96f4d",
  name: "Alternating Cross-Body Dumbbell Hammer Curl",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "alternating",
  grip: "hang",
  phaseLabels: ["Curl", "Peak", "Switch", "Other"],
  tempo: { lower: 1.3, bottom: 0.25, raise: 1.3, top: 0.25 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells", sides: ["L", "R"] },
  hints: {
    start: { ...TRUNK, ...REST_ARM },
    end: sidedHints("L", CROSS, REST_ARM, TRUNK),
  },
  checks: () => [
    checkFlatBack(
      "Pick up a pair of dumbbells and stand upright in a hip-width stance while holding the dumbbells at your sides with straight elbows.",
    ),
    checkJointWithinAt(
      "start-extended",
      "Both elbows start extended",
      "Stand upright while holding the dumbbells at your sides with straight elbows.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "left-peak-flex",
      "Working elbow fully flexes across the body",
      "Curl one dumbbell upward and across the front of your torso toward the opposite shoulder.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
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
      "Cross-body hammer curl",
      "After your elbow has fully flexed, lower the dumbbell until it is back at your side.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "neutral-grip",
      label: "Neutral grip held throughout",
      cue: "Direct your palms so that they are facing in toward your sides, and keep the hammer grip.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 28, "° away from a neutral forearm"),
    },
  ],
});
