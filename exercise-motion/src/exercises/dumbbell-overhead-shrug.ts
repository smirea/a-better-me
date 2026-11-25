import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Arms locked overhead, palms in. Only the shoulder girdle rises. */
const OVERHEAD = {
  "shoulder.elev": 166,
  "shoulder.plane": 18,
  "shoulder.twist": 6,
  "elbow.flex": 6,
  "forearm.pron": 8,
  "wrist.flex": 4,
  "wrist.dev": 0,
  "clavicle.prot": 2,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -2,
  "thoracic.flex": -2,
  "hip.flex": 4,
  "knee.flex": 4,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-overhead-shrug",
  catalogId: "3595c6f170d88049a505e34c26d57cdb",
  name: "Dumbbell Overhead Shrug",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "press",
  cameraHint: { view: "Front" },
  phaseLabels: ["Shrug", "Ears", "Lower", "Long"],
  tempo: { lower: 1.4, bottom: 0.25, raise: 1.2, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8 },
  apparatus: { kind: "dumbbells", anchor: "press" },
  stiffness: { elbow: 5, shoulder: 2.6, clavicle: 0.5, knee: 3, lumbar: 7 },
  hints: {
    start: { ...TRUNK, ...OVERHEAD, "clavicle.elev": 6, "neck.flex": 2 },
    end: { ...TRUNK, ...OVERHEAD, "clavicle.elev": 26, "neck.flex": 2 },
  },
  extraKeyGoals: (body) => ({
    start: [
      lockAngle(body, "shoulder_L.elev", 166, 36),
      lockAngle(body, "shoulder_R.elev", 166, 36),
      lockAngle(body, "elbow_L.flex", 6, 32),
      lockAngle(body, "elbow_R.flex", 6, 32),
      lockAngle(body, "clavicle_L.elev", 6, 44),
      lockAngle(body, "clavicle_R.elev", 6, 44),
    ],
    end: [
      lockAngle(body, "shoulder_L.elev", 166, 36),
      lockAngle(body, "shoulder_R.elev", 166, 36),
      lockAngle(body, "elbow_L.flex", 6, 32),
      lockAngle(body, "elbow_R.flex", 6, 32),
      lockAngle(body, "clavicle_L.elev", 26, 44),
      lockAngle(body, "clavicle_R.elev", 26, 44),
    ],
  }),
  checks: () => [
    checkFlatBack("Stay upright. Brace so the lower back does not arch to help the shrug.", 16),
    checkNeutralNeck("Look straight ahead and keep the neck near neutral."),
    checkFeetPlanted("Keep the feet planted. The legs stay still while the shoulders move."),
    checkJointWithinAt(
      "arms-overhead",
      "Arms stay overhead",
      "Keep the arms directed straight up with the elbows straight.",
      "shoulder_L.elev",
      "peak",
      145,
      175,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows stay straight",
      "Shrug with the elbows locked overhead.",
      "elbow_L.flex",
      "peak",
      0,
      18,
    ),
    checkJointRange(
      "shrug-rom",
      "Shoulder girdle elevates overhead",
      "Shrug the shoulders up toward the ears, then let them descend under control.",
      "clavicle_L.elev",
      14,
    ),
  ],
});
