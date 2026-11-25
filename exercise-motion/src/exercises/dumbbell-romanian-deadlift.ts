import { anchorPoint, type Body, type Frame } from "../body";
import { everyFrame } from "../checks";
import type { FormCheck } from "../exercise";
import { carryProp, graspProp } from "../grasp";
import { dumbbellProp, propHandles } from "../machines";
import { deg } from "../math";
import {
  checkFeetPlanted,
  checkFlatBack,
  checkJointRange,
  checkJointWithinAt,
  checkNeutralNeck,
  plantBothFeet,
  POSTURE_HINTS,
} from "../postures";
import { composeExercise } from "../scene";
import { balance, lockAngle, mirrored, type Goal } from "../solver";

const KG = 22.5;
const HEEL_Z = -0.05;
const STANCE_X = 0.11;
/** Over the middle of the foot, where the weight and the lifter balance. */
const MIDFOOT_Z = HEEL_Z + 0.1;
/** Hands by the outer front of the thighs. */
const GRIP_X = 0.2;

/** Shin lean from vertical in the sagittal plane, positive with the knee ahead of the ankle. */
const shinLean = (body: Body, frame: Frame) => {
  const knee = frame.pos[body.index.knee_L];
  const ankle = frame.pos[body.index.ankle_L];
  return deg(Math.atan2(knee.z - ankle.z, knee.y - ankle.y));
};

const verticalShins = (body: Body, weight: number): Goal => ({ frame, push }) => {
  for (const side of ["L", "R"] as const) {
    const knee = frame.pos[body.index[`knee_${side}`]];
    const ankle = frame.pos[body.index[`ankle_${side}`]];
    push(weight * (knee.z - ankle.z - 0.02));
  }
};

/** Arms hang straight down from the shoulders, so the dumbbells stay over the feet and close to the legs. */
const armsHang = (body: Body, weight: number): Goal => ({ frame, push }) => {
  for (const side of ["L", "R"] as const) {
    const grip = anchorPoint(body, frame, `grip_${side}`);
    const shoulder = frame.pos[body.index[`shoulder_${side}`]];
    push(weight * (grip.z - shoulder.z));
    push(weight * (grip.x - (side === "L" ? 1 : -1) * GRIP_X));
  }
};

const checks: FormCheck[] = [
  checkJointRange(
    "hip-hinge",
    "Hinges deeply at the hips",
    "Continue hinging at your hips through the full range of motion in which you can comfortably move.",
    "hip_L.flex",
    60,
  ),
  checkJointWithinAt(
    "soft-knees",
    "Knees bend only mildly",
    "you should not keep your knees fully straightened. You do not need to focus on bending your knees, since the appropriately mild degree of knee bend can naturally occur when you sit your buttocks backward",
    "knee_L.flex",
    "peak",
    10,
    40,
  ),
  {
    id: "vertical-shins",
    label: "Shins stay vertical",
    cue: "your shins should remain in a vertical position throughout your set",
    evaluate: (context) => everyFrame(context, (frame) => Math.abs(shinLean(context.body, frame)), 8, "° of shin lean"),
  },
  {
    id: "below-knees",
    label: "Dumbbells reach below the knees",
    cue: "Lifters with normal flexibility can typically lower the dumbbells at least below their knees",
    evaluate: ({ body, frames, bottom }) => {
      const grip = anchorPoint(body, frames[bottom], "grip_L").y;
      const knee = anchorPoint(body, frames[bottom], "kneeFront_L").y;
      return { pass: grip < knee, measured: `grip ${((knee - grip) * 100).toFixed(1)} cm below the knee at the bottom` };
    },
  },
  {
    id: "dumbbells-close",
    label: "Dumbbells stay close to the legs",
    cue: "Continue keeping your elbows straight with the dumbbells just in front of your legs. Avoid letting the dumbbells drift forward away from you",
    evaluate: (context) =>
      everyFrame(
        context,
        (frame) => (anchorPoint(context.body, frame, "grip_L").z - anchorPoint(context.body, frame, "shinFront_L").z) * 100,
        12,
        " cm ahead of the shin",
      ),
  },
  {
    id: "stacked-top",
    label: "Hips stacked under the shoulders at the top",
    cue: "you should be able to draw a straight line from your shoulders through your hips to the middle of your feet when viewed from the side.",
    evaluate: ({ body, frames, top }) => {
      const f = frames[top];
      const off = Math.max(
        Math.abs(f.pos[body.index.shoulder_L].z - MIDFOOT_Z),
        Math.abs(f.pos[body.index.hip_L].z - MIDFOOT_Z),
      );
      return { pass: off < 0.06, measured: `shoulder and hip within ${(off * 100).toFixed(1)} cm of midfoot at the top (target < 6 cm)` };
    },
  },
  checkJointWithinAt("straight-elbows", "Elbows stay straight", "Continue keeping your elbows straight", "elbow_L.flex", "peak", 0, 15),
  checkFlatBack("sit your buttocks backward to hinge at your hips in a controlled manner as you keep your lower back flat, chest up, and core braced."),
  checkFeetPlanted("Throughout the set, keep the soles of your feet fully planted on the ground"),
  checkNeutralNeck("your neck near a neutral position, like when you are normally standing upright and looking straight ahead."),
];

export const spec = composeExercise({
  id: "dumbbell-romanian-deadlift",
  catalogId: "1a35c6f170d880489b7be1d31faff56b",
  name: "Dumbbell Romanian Deadlift",
  defaultLoadKg: KG,
  loadUnit: "perSide",
  setup(body) {
    const handle = propHandles("prop-dumbbell").grip;
    const props = [dumbbellProp("dbL"), dumbbellProp("dbR")];
    const grasps = [graspProp("L", "dbL", handle), graspProp("R", "dbR", handle)];
    const s = POSTURE_HINTS.standing;
    // Semi-overhand: palms between backward and in toward each other, held that way all set.
    const arms = { "shoulder.twist": 10, "forearm.pron": 45, "elbow.flex": 4 };
    return {
      hints: {
        start: { ...s, "root.z": 0.03, ...arms, "shoulder.elev": 8, "shoulder.plane": 80 },
        end: {
          ...s,
          ...arms,
          "root.y": 0.925,
          "root.z": -0.2,
          "root.pitch": 68,
          "hip.flex": 90,
          "knee.flex": 32,
          "ankle.dorsi": 2,
          "shoulder.elev": 66,
          "shoulder.plane": 88,
          "neck.flex": 4,
        },
      },
      goals: [
        ...plantBothFeet(body, STANCE_X, HEEL_Z, 0.08),
        balance(body, [{ anchor: "grip_L", kg: KG }, { anchor: "grip_R", kg: KG }], MIDFOOT_Z, 20),
        verticalShins(body, 12),
        armsHang(body, 5),
        lockAngle(body, "elbow_L.flex", 4, 6),
        lockAngle(body, "elbow_R.flex", 4, 6),
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [lockAngle(body, "hip_L.flex", 2, 10), lockAngle(body, "knee_L.flex", 4, 10)],
        end: [lockAngle(body, "hip_L.flex", 90, 12), lockAngle(body, "knee_L.flex", 32, 8)],
      },
      stiffness: { default: 1, lumbar: 10, thoracic: 10, neck: 4 },
      progress: (frame) => anchorPoint(body, frame, "grip_L").y,
      ground: "heel_L",
      props,
      propState: (frame) => props.map((p) => carryProp(body, frame, p, grasps)),
      grasps,
      loads: [
        { anchor: "grip_L", share: 1, grip: "hang" },
        { anchor: "grip_R", share: 1, grip: "hang" },
      ],
      support: { kind: "standing", brace: true },
      required: [
        { label: "Left heel", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel", anchor: "heel_R", surfaceY: 0 },
        { label: "Left ball", anchor: "ballIn_L", surfaceY: 0 },
        { label: "Right ball", anchor: "ballIn_R", surfaceY: 0 },
      ],
      checks,
      cameraHint: { view: "Side" },
    };
  },
});
