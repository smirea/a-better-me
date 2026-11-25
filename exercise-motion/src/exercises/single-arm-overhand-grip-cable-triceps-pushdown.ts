import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const ACTIVE = {
  "shoulder.elev": 22,
  "shoulder.plane": 22,
  "shoulder.twist": 16,
  "forearm.pron": 72,
  "wrist.flex": -2,
  "clavicle.elev": 2,
  "clavicle.prot": -4,
};

const REST = {
  "shoulder.elev": 12,
  "shoulder.plane": 15,
  "elbow.flex": 10,
  "forearm.pron": 15,
  "wrist.flex": 0,
  "clavicle.elev": 0,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 10,
  "hip.flex": 16,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 4,
  "knee.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "single-arm-overhand-grip-cable-triceps-pushdown",
  catalogId: "1a15c6f170d880cabfbff4d5b4e34294",
  name: "Single Arm Overhand Grip Cable Triceps Pushdown",
  defaultLoadKg: 10,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Press", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.15, heelZ: -0.04, torsoLeanDeg: 10, balanceZ: false },
  apparatus: {
    kind: "cable-single",
    pulley: [0.18, 2.08, 0.72],
    facingDir: -1,
    attachment: "d-handle",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 122 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "elbow.flex": 8 }, REST, TRUNK),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.1, -0.28, 0.05], 16, "xz")],
  checks: () => [
    checkFlatBack(
      "Take a step backward and slightly lean forward by hinging at your hips. Maintain this slight torso lean throughout your set.",
    ),
    checkJointWithinAt(
      "elbow-bent",
      "Elbow starts close to fully bent",
      "Pull your upper arm down and back until it is positioned at your sides with your elbow being close to fully bent.",
      "elbow_L.flex",
      "top",
      100,
      145,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Handle finishes by the side",
      "Push the handle downward by extending your elbow until it is straightened. At the end of this motion, the handle should be situated by your side.",
      "elbow_L.flex",
      "bottom",
      0,
      20,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbow extends through the pushdown",
      "Push the handle downward by extending your elbow until it is straightened.",
      "elbow_L.flex",
      90,
    ),
    {
      id: "overhand-wrist",
      label: "Overhand grip with a fairly straight wrist",
      cue: "Grasp the handle with an overhand grip such that your palm is facing forward and away from you while keeping your wrist fairly straight.",
      evaluate: (context) =>
        everyFrame(
          context,
          (_, angles) => {
            const pron = deg(angles["forearm_L.pron"]);
            const wrist = Math.abs(deg(angles["wrist_L.flex"]));
            return (pron < 45 ? 45 - pron : 0) + (wrist > 20 ? wrist - 20 : 0);
          },
          12,
          " grip-score",
        ),
    },
  ],
});
