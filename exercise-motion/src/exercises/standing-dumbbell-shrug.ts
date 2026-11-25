import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Palms face the thighs, elbows straight, dumbbells beside the legs. */
const ARMS = {
  "shoulder.elev": 12,
  "shoulder.plane": 16,
  "shoulder.twist": 2,
  "elbow.flex": 8,
  "forearm.pron": 6,
  "wrist.flex": 2,
  "clavicle.prot": 0,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-shrug",
  catalogId: "1a15c6f170d8800abba4d3ef66a48aa6",
  name: "Standing Dumbbell Shrug",
  defaultLoadKg: 16,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  stiffness: { elbow: 6, knee: 4, lumbar: 8, clavicle: 1.1 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "clavicle.elev": 26 },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright with the dumbbells by the thighs. The legs stay straight while the shoulders move.",
    ),
    checkNeutralNeck("Look straight ahead so the neck stays near neutral."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Shrug the shoulders up toward the earlobes while the elbows stay straight.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointWithinAt(
      "shoulders-up",
      "Shoulders finish elevated",
      "Drive the shoulders up toward the earlobes through the available range.",
      "clavicle_L.elev",
      "peak",
      16,
      36,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Let the dumbbells depress the shoulders a little below rest, then shrug them back up.",
      "clavicle_L.elev",
      18,
    ),
  ],
});
