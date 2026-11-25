import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Side-on to a shoulder-height pulley. The arm stays in a T while the elbow curls toward the ear. */
const OUT = {
  "shoulder.elev": 84,
  "shoulder.plane": 12,
  "shoulder.twist": -52,
  "elbow.flex": 8,
  "forearm.pron": -55,
  "wrist.flex": 0,
  "clavicle.elev": 8,
  "clavicle.prot": -8,
};

const IN = {
  ...OUT,
  "elbow.flex": 100,
};

const FREE = {
  "shoulder.elev": 28,
  "shoulder.plane": 62,
  "shoulder.twist": 4,
  "elbow.flex": 96,
  "forearm.pron": 8,
  "wrist.flex": 4,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

export const spec = buildExerciseSpec({
  id: "single-arm-crucifix-curl",
  catalogId: "2cc5c6f170d88074a5e5eff1282b47f2",
  name: "Single Arm Crucifix Curl",
  defaultLoadKg: 2,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  cameraHint: { view: "Front" },
  phaseLabels: ["Curl", "Ear", "Lower", "Out"],
  tempo: { lower: 1.4, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.26, heelZ: 0.02, toeOutDeg: 8, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [1.05, 1.48, 0.06],
    columnPos: [1.22, 0.16],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  stiffness: { elbow: 16, shoulder: 3.2, lumbar: 9, thoracic: 8 },
  hints: {
    start: sidedHints("L", OUT, FREE, POSTURE_HINTS.standing),
    end: sidedHints("L", IN, FREE, POSTURE_HINTS.standing),
  },
  extraKeyGoals: (body) => ({
    end: [lockAngle(body, "elbow_L.flex", 100, 40), lockAngle(body, "shoulder_L.plane", 12, 18)],
  }),
  checks: () => [
    checkFlatBack(
      "Pull your shoulder blades back together with a proud chest posture and keep the rest of your body still.",
    ),
    checkJointWithinAt(
      "arm-out",
      "Upper arm stays directed toward the pulley",
      "Keep your upper arm stationary as it remains directed toward the pulley.",
      "shoulder_L.elev",
      "peak",
      72,
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
      "Elbow finishes bent toward the ear",
      "Bend your elbow to curl the handle in toward your ear.",
      "elbow_L.flex",
      "bottom",
      68,
      145,
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Bend your elbow to curl the handle in toward your ear, then straighten it under control.",
      "elbow_L.flex",
      60,
    ),
    {
      id: "palm-up",
      label: "Palm stays up",
      cue: "Rotate your palm to point up toward the ceiling with a straight wrist.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => deg(angles["forearm_L.pron"]), -40, "° of forearm pronation"),
    },
  ],
});
