import { Vector3 } from "three";
import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS, sidedHints } from "../builders";
import { everyFrame } from "../checks";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Hip-hinged kickback: working upper arm locked horizontal, free hand reaches toward the column. */
const ACTIVE = {
  "shoulder.elev": 78,
  "shoulder.plane": -55,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": -8,
};

const REST = {
  "shoulder.elev": 70,
  "shoulder.plane": 75,
  "shoulder.twist": 10,
  "elbow.flex": 18,
  "forearm.pron": 10,
  "wrist.flex": 0,
  "clavicle.elev": 4,
};

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 48,
  "hip.flex": 58,
  "hip.abd": 6,
  "lumbar.flex": 8,
  "thoracic.flex": 8,
  "neck.flex": -8,
  "knee.flex": 22,
  "ankle.dorsi": 8,
};

export const spec = buildExerciseSpec({
  id: "neutral-grip-cable-triceps-kickback",
  catalogId: "1a15c6f170d8800d8e3eee8e00854767",
  name: "Neutral Grip Cable Triceps Kickback",
  defaultLoadKg: 3,
  loadUnit: "perSide",
  laterality: "unilateral",
  activeSide: "L",
  grip: "hang",
  phaseLabels: ["Kick", "Lockout", "Return", "Stretch"],
  tempo: { lower: 1.2, bottom: 0.3, raise: 1.6, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, heelZ: 0.06, torsoLeanDeg: 46, balanceZ: false },
  stiffness: { elbow: 8, shoulder: 1.6 },
  apparatus: {
    kind: "cable-single",
    pulley: [0.22, 0.75, 1.05],
    facingDir: -1,
    attachment: "rope",
    sides: ["L"],
  },
  hints: {
    start: sidedHints("L", { ...ACTIVE, "elbow.flex": 110 }, REST, TRUNK),
    end: sidedHints("L", { ...ACTIVE, "elbow.flex": 8 }, REST, TRUNK),
  },
  extraGoals: (body) => [holdElbowNearShoulder(body, "L", [0.1, 0.0, -0.18], 12, "xz")],
  checks: (body) => [
    {
      id: "torso-hinge",
      label: "Torso stays hinged near horizontal",
      cue: "Hinge at your hips to sit your buttocks back, and incline your torso so that it is fairly close to being in a horizontal position. Maintain this bent-over-torso position throughout your set.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const up = new Vector3(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
            return Math.abs(deg(Math.atan2(up.z, up.y)) - 50);
          },
          18,
          "° off a hip-hinged torso",
        ),
    },
    checkJointWithinAt(
      "elbow-bent",
      "Elbow starts bent at least 90 degrees",
      "In this starting position, your elbow should be bent by at least 90 degrees.",
      "elbow_L.flex",
      "top",
      85,
      130,
    ),
    checkJointWithinAt(
      "elbow-straight",
      "Elbow finishes straight",
      "While keeping your upper arm parallel to the ground, progressively straighten your elbow until you have fully straightened your elbow.",
      "elbow_L.flex",
      "bottom",
      0,
      18,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbow extends through the kickback",
      "Straighten your elbow to drive the cable backward and upward in an arcing motion.",
      "elbow_L.flex",
      75,
    ),
    {
      id: "upper-arm-level",
      label: "Upper arm stays parallel to the ground",
      cue: "Continue keeping your upper arm parallel to the ground.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => {
            const shoulder = frame.pos[context.body.index.shoulder_L];
            const elbow = frame.pos[context.body.index.elbow_L];
            return Math.abs(elbow.y - shoulder.y) * 100 + Math.max(0, elbow.z - shoulder.z) * 80;
          },
          28,
          " cm off a horizontal upper arm",
        ),
    },
    {
      id: "neutral-grip",
      label: "Neutral grip",
      cue: "Firmly grasp the rope with a neutral grip such that your palm is facing in toward your other side.",
      evaluate: (context) =>
        everyFrame(context, (_, angles) => Math.abs(deg(angles["forearm_L.pron"])), 30, "° from neutral"),
    },
  ],
});
