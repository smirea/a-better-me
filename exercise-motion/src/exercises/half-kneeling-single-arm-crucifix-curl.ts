import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle, plantToe } from "../solver";

/** Half-kneeling, side-on to a shoulder-height pulley. The arm stays in a T and curls toward the ear. */
const LEGS = {
  ...POSTURE_HINTS.kneeling,
  "root.y": 0.72,
  "root.pitch": 2,
  "lumbar.flex": 2,
  "thoracic.flex": -2,
  "neck.flex": 2,
  "hip_R.flex": 92,
  "hip_R.abd": 4,
  "knee_R.flex": 92,
  "ankle_R.dorsi": 4,
  "hip_L.flex": 18,
  "hip_L.abd": 4,
  "knee_L.flex": 100,
  "ankle_L.dorsi": 8,
};

const OUT = {
  "shoulder.elev": 84,
  "shoulder.plane": 12,
  "shoulder.twist": -52,
  "forearm.pron": -55,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
};

const FREE = {
  "shoulder.elev": 22,
  "shoulder.plane": 64,
  "shoulder.twist": 4,
  "elbow.flex": 80,
  "forearm.pron": 10,
  "wrist.flex": 6,
  "clavicle.elev": 2,
};

export const spec = buildExerciseSpec({
  id: "half-kneeling-single-arm-crucifix-curl",
  catalogId: "2ab5c6f170d880708a30f9f8872c6084",
  name: "Half-Kneeling Single Arm Crucifix Curl",
  defaultLoadKg: 2.5,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Ear", "Lower", "Out"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "kneeling", halfKneelingSide: "R", leanDeg: 2 },
  apparatus: {
    kind: "cable-single",
    pulley: [1.02, 1.16, 0.02],
    columnPos: [1.22, 0.08],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 16, shoulder: 3.2, lumbar: 12, thoracic: 10, knee: 5 },
  hints: {
    start: sidedHints("L", { ...OUT, "elbow.flex": 8 }, FREE, LEGS),
    end: sidedHints("L", { ...OUT, "elbow.flex": 100 }, FREE, LEGS),
  },
  extraGoals: (body) => [...plantToe(body, "L", new Vector3(0.14, 0.06, -0.5), 0, 90)],
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "elbow_L.flex", 100, 40)],
  }),
  checks: () => [
    checkJointWithinAt(
      "upright",
      "Torso stays upright",
      "Keep your torso upright, shoulders level with each other, and your arm aligned with the cable.",
      "thoracic.flex",
      "peak",
      -14,
      12,
    ),
    checkJointWithinAt(
      "square",
      "Belt buckle faces away from the cable",
      "In this position, your imaginary belt buckle should be facing about 90 degrees away from the cable station.",
      "thoracic.twist",
      "peak",
      -14,
      14,
    ),
    checkJointWithinAt(
      "arm-out",
      "Upper arm stays directed toward the pulley",
      "Keep your upper arm stationary as it remains directed toward the pulley.",
      "shoulder_L.elev",
      "peak",
      70,
      108,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow starts straight",
      "Reach out to your side and firmly grasp the handle with a straight elbow.",
      "elbow_L.flex",
      "top",
      0,
      24,
    ),
    checkJointWithinAt(
      "elbow-bent",
      "Elbow curls toward the ear",
      "Bend your elbow to curl the handle in toward your ear.",
      "elbow_L.flex",
      "bottom",
      68,
      140,
    ),
    checkJointRange(
      "elbow-rom",
      "Half-kneeling biceps pose",
      "At the end of this movement, you should look like you are flexing for a biceps pose.",
      "elbow_L.flex",
      58,
    ),
    {
      id: "palm-up",
      label: "Palm points up",
      cue: "Rotate your palm to point up toward the ceiling with a straight wrist.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
