import { Vector3 } from "three";
import { buildExerciseSpec, sidedHints } from "../builders";
import { checkFlatBack, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle, pin, plantFoot } from "../solver";

/** Reverse plank held on one heel. The free leg stays straight and off the floor. */
const BASE = {
  "root.y": 0.38,
  "root.z": 0.05,
  "root.pitch": -6,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
  "neck.flex": 8,
  "hip.abd": 6,
  "ankle.dorsi": -6,
  "clavicle.prot": -18,
  "clavicle.elev": -4,
  "shoulder.elev": 32,
  "shoulder.plane": 78,
  "shoulder.twist": -6,
  "elbow.flex": 8,
  "forearm.pron": 20,
  "wrist.flex": -28,
};

const SUPPORT = { "hip.flex": 8, "knee.flex": 12, "ankle.dorsi": 14 };
const FREE = { "hip.flex": 58, "hip.abd": 22, "knee.flex": 10, "ankle.dorsi": 10 };

export const spec = buildExerciseSpec({
  id: "single-leg-reverse-plank",
  catalogId: "2765c6f170d88019b20bc2a1cf268901",
  name: "Single Leg Reverse Plank",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "asymmetrical",
  grip: "open",
  isometric: true,
  brace: true,
  cameraHint: { view: "Side" },
  phaseLabels: ["Set", "Lift", "Hold", "Hold"],
  station: {
    kind: "lying",
    surface: "floor",
    face: "up",
    pinSacrum: false,
    feetOnFloor: false,
  },
  extraGoals: (body) => [
    pin(body, "palmFlat_L", () => new Vector3(0.22, 0.045, -0.32), 44),
    pin(body, "palmFlat_R", () => new Vector3(-0.22, 0.045, -0.32), 44),
    ...plantFoot(body, "R", new Vector3(-0.1, 0.085, 0.58), 0.08, 36),
    lockAngle(body, "ankle_R.dorsi", -2, 8),
  ],
  stiffness: { hip: 6, knee: 6, shoulder: 10, elbow: 10, lumbar: 12, wrist: 6 },
  apparatus: {
    kind: "none",
    bodyweightLoads: [
      { anchor: "palmFlat_L", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "palmFlat_R", bodyweightShare: 0.22, grip: "press", direction: [0, 1, 0] },
      { anchor: "heel_R", bodyweightShare: 0.28, grip: "press", direction: [0, 1, 0] },
    ],
  },
  hints: {
    start: sidedHints("L", FREE, SUPPORT, BASE),
    end: sidedHints("L", FREE, SUPPORT, BASE),
  },
  checks: () => [
    checkFlatBack(
      "Keep the hip bones level. The free-side hip should not drop. Imagine a mug of water balanced on the waist.",
      14,
    ),
    checkNeutralNeck("Keep the neck near neutral."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay straight",
      "Arms stay straight under the shoulders.",
      "elbow_L.flex",
      "start",
      -8,
      22,
    ),
    checkJointWithinAt(
      "support-leg-straight",
      "Supporting knee stays straight",
      "The grounded leg stays in line with the torso.",
      "knee_R.flex",
      "start",
      0,
      42,
    ),
    checkJointWithinAt(
      "free-leg-up",
      "Free foot stays off the floor",
      "Lift the free leg with a straight knee just high enough that the foot never touches down.",
      "hip_L.flex",
      "start",
      28,
      80,
    ),
  ],
});
