import { Vector3 } from "three";
import { anchorPoint, SIDES, type Body, type Frame, type Side } from "../body";
import { everyFrame } from "../checks";
import type { FormCheck } from "../exercise";
import { carryProp, graspProp } from "../grasp";
import { deg, rad } from "../math";
import { dumbbellProp, propHandles } from "../machines";
import { checkFlatBack, checkNeutralNeck, plantBothFeet, POSTURE_HINTS } from "../postures";
import { composeExercise } from "../scene";
import { balance, lockAngle, mirrored, type Goal } from "../solver";

const LOAD_KG = 12;
/** Heels this far either side of the midline: about hip width for this body. */
const STANCE_X = 0.13;
const HEEL_Z = -0.08;
/**
 * The hex head is 8.1 cm around the handle, and the thigh face sits 8 cm off the bone.
 * The handle has to live about a head-radius in front of that face or the plate is inside the thigh.
 */
const AHEAD_OF_THIGH = 0.09;

const stand = POSTURE_HINTS.standing;

function sideSign(side: Side): number {
  return side === "L" ? 1 : -1;
}

/** Knee joint over the ankle in the side view, so the shin stays vertical. */
function verticalShin(body: Body, side: Side, weight: number): Goal {
  return ({ frame, push }) => {
    const knee = frame.pos[body.index[`knee_${side}`]];
    const ankle = frame.pos[body.index[`ankle_${side}`]];
    push(weight * (knee.z - ankle.z));
  };
}

/**
 * Hangs the dumbbell on the outer front of the thigh. World +Z is "in front of the leg" in the
 * side view the cue is about; the plate radius is why the handle sits ahead of the thigh face.
 */
function hangByThigh(body: Body, side: Side, weight: number): Goal {
  const s = sideSign(side);
  const grip = new Vector3();
  const thigh = new Vector3();
  return ({ frame, push }) => {
    anchorPoint(body, frame, `grip_${side}`, grip);
    anchorPoint(body, frame, `thighFront_${side}`, thigh);
    push(weight * (grip.z - (thigh.z + AHEAD_OF_THIGH)));
    // Outside the thigh face, not on its centre: the inner heads meet if the hands sit any closer.
    push(weight * 0.7 * (grip.x - (thigh.x + s * 0.11)));
  };
}

/** How far the grip sits in front of the shin, in metres. Positive is drifting away from the leg. */
function leadOfLeg(body: Body, frame: Frame, side: Side): number {
  const grip = anchorPoint(body, frame, `grip_${side}`);
  const shin = anchorPoint(body, frame, `shinFront_${side}`);
  const thigh = anchorPoint(body, frame, `thighFront_${side}`);
  return grip.z - Math.max(shin.z, thigh.z);
}

/** Hip's miss of the shoulder-to-midfoot line, and how far the shoulders sit behind the hips (cm). */
function stack(body: Body, frame: Frame): { hipCm: number; behindCm: number } {
  const shoulder = new Vector3()
    .add(frame.pos[body.index.shoulder_L])
    .add(frame.pos[body.index.shoulder_R])
    .multiplyScalar(0.5);
  const hip = new Vector3().add(frame.pos[body.index.hip_L]).add(frame.pos[body.index.hip_R]).multiplyScalar(0.5);
  let midZ = 0;
  let midY = 0;
  for (const name of ["heel_L", "heel_R", "secondToe_L", "secondToe_R"]) {
    const p = anchorPoint(body, frame, name);
    midZ += p.z;
    midY += p.y;
  }
  midZ /= 4;
  midY /= 4;
  const t = (hip.y - shoulder.y) / (midY - shoulder.y);
  const lineZ = shoulder.z + t * (midZ - shoulder.z);
  return { hipCm: Math.abs(hip.z - lineZ) * 100, behindCm: (hip.z - shoulder.z) * 100 };
}

const checks: FormCheck[] = [
  {
    id: "elbows-straight",
    label: "Elbows stay straight",
    cue: "Continue keeping your elbows straight with the dumbbells just in front of your legs.",
    evaluate: (context) =>
      everyFrame(
        context,
        (_, angles) => Math.max(deg(angles["elbow_L.flex"]), deg(angles["elbow_R.flex"])),
        12,
        "° of elbow bend",
      ),
  },
  {
    id: "close-to-legs",
    label: "Dumbbells stay against the legs",
    cue: "Keep the dumbbells just in front of your legs. Avoid letting the dumbbells drift forward away from you.",
    evaluate: (context) =>
      everyFrame(
        context,
        (frame) => Math.max(...SIDES.map((side) => leadOfLeg(context.body, frame, side))) * 100,
        16,
        " cm in front of the leg",
      ),
  },
  {
    id: "shins-vertical",
    label: "Shins stay vertical",
    cue: "Your shins should remain in a vertical position throughout your set.",
    evaluate: (context) =>
      everyFrame(context, (frame) => {
        let worst = 0;
        for (const side of SIDES) {
          const knee = frame.pos[context.body.index[`knee_${side}`]];
          const ankle = frame.pos[context.body.index[`ankle_${side}`]];
          worst = Math.max(worst, Math.abs(knee.z - ankle.z));
        }
        return worst * 100;
      }, 5, " cm of shin lean"),
  },
  {
    id: "soft-knees",
    label: "Knees stay softly bent",
    cue: "While allowing your knees to bend mildly, you should not keep your knees fully straightened.",
    evaluate: (context) => {
      let worst = 0;
      for (const angles of context.angles) {
        for (const side of SIDES) {
          const bend = deg(angles[`knee_${side}.flex`]);
          worst = Math.max(worst, Math.max(0, 8 - bend), Math.max(0, bend - 32));
        }
      }
      return {
        pass: worst <= 0,
        measured: worst <= 0 ? "both knees stay mildly bent" : `knee bend misses the mild range by ${worst.toFixed(1)}°`,
      };
    },
  },
  {
    id: "below-knees",
    label: "Dumbbells pass below the knees",
    cue: "Lifters with normal flexibility can typically lower the dumbbells at least below their knees.",
    evaluate: ({ body, frames, bottom }) => {
      const frame = frames[bottom];
      const gaps = SIDES.map((side) => {
        const grip = anchorPoint(body, frame, `grip_${side}`);
        const knee = frame.pos[body.index[`knee_${side}`]];
        return (knee.y - grip.y) * 100;
      });
      const worst = Math.min(...gaps);
      return {
        pass: worst >= 0,
        measured: `handles finish ${worst.toFixed(1)} cm below the knee`,
      };
    },
  },
  {
    id: "soles-planted",
    label: "Soles stay planted",
    cue: "Keep the soles of your feet fully planted on the ground.",
    evaluate: (context) =>
      everyFrame(context, (frame) => {
        let worst = 0;
        for (const side of SIDES) {
          for (const part of ["heel", "ballIn", "ballOut", "toe"]) {
            worst = Math.max(worst, Math.abs(anchorPoint(context.body, frame, `${part}_${side}`).y));
          }
        }
        return worst * 1000;
      }, 12, " mm off the floor"),
  },
  {
    id: "stacked-top",
    label: "Stands stacked at the top",
    cue: "Draw a straight line from your shoulders through your hips to the middle of your feet. Avoid leaning back at the top.",
    evaluate: ({ body, frames, top }) => {
      const { hipCm, behindCm } = stack(body, frames[top]);
      const pass = hipCm <= 5 && behindCm <= 1;
      return {
        pass,
        measured: `hip is ${hipCm.toFixed(1)} cm off the shoulder-to-midfoot line, shoulders ${behindCm.toFixed(1)} cm behind the hips`,
      };
    },
  },
  {
    id: "hip-hinge",
    label: "The hips do the moving",
    cue: "Most of the motion should come from your hips.",
    evaluate: ({ angles }) => {
      const span = (key: string) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const a of angles) {
          const d = deg(a[key]);
          if (d < lo) lo = d;
          if (d > hi) hi = d;
        }
        return hi - lo;
      };
      const hip = Math.min(span("hip_L.flex"), span("hip_R.flex"));
      const knee = Math.max(span("knee_L.flex"), span("knee_R.flex"));
      return {
        pass: hip >= 45 && hip > knee * 2,
        measured: `hips move ${hip.toFixed(0)}°, knees move ${knee.toFixed(0)}°`,
      };
    },
  },
  {
    id: "semi-overhand",
    label: "Palms stay semi-overhand",
    cue: "Situate your palms so they face at an angle between backward and in toward each other, and keep your palms facing this way throughout your set.",
    evaluate: (context) =>
      everyFrame(context, (_, angles) => {
        let worst = 0;
        for (const side of SIDES) {
          const pron = deg(angles[`forearm_${side}.pron`]);
          worst = Math.max(worst, Math.max(0, 20 - pron), Math.max(0, pron - 70));
        }
        return worst;
      }, 0, "° outside a semi-overhand grip"),
  },
];

export const spec = composeExercise({
  id: "dumbbell-romanian-deadlift",
  catalogId: "1a35c6f170d880489b7be1d31faff56b",
  name: "Dumbbell Romanian Deadlift",
  defaultLoadKg: LOAD_KG,
  loadUnit: "perSide",
  setup(body) {
    const handle = propHandles("prop-dumbbell").grip;
    const props = [dumbbellProp("dbL"), dumbbellProp("dbR")];
    const grasps = [graspProp("L", "dbL", handle), graspProp("R", "dbR", handle)];
    const tall = {
      ...stand,
      "root.pitch": 5,
      "hip.flex": 12,
      "hip.abd": 8,
      "knee.flex": 12,
      "clavicle.prot": 4,
      "clavicle.elev": 2,
      "elbow.flex": 6,
      "forearm.pron": 42,
      "shoulder.elev": 18,
      "shoulder.plane": 62,
      "wrist.flex": 0,
      "wrist.dev": 0,
      "lumbar.flex": -2,
      "thoracic.flex": -2,
      "neck.flex": 0,
    };
    return {
      hints: {
        start: tall,
        end: {
          ...tall,
          "root.z": -0.2,
          "root.pitch": 76,
          "hip.flex": 98,
          "knee.flex": 16,
          "shoulder.elev": 16,
          "shoulder.plane": 70,
          "neck.flex": 4,
        },
      },
      goals: [
        ...plantBothFeet(body, STANCE_X, HEEL_Z, 0.1),
        balance(body, [
          { anchor: "grip_L", kg: LOAD_KG },
          { anchor: "grip_R", kg: LOAD_KG },
        ], 0.04, 28),
        mirrored(body, 8),
        ...SIDES.flatMap((side) => [
          lockAngle(body, `elbow_${side}.flex`, 6, 18),
          lockAngle(body, `knee_${side}.flex`, 14, 16),
          lockAngle(body, `forearm_${side}.pron`, 42, 12),
          lockAngle(body, `wrist_${side}.flex`, 0, 8),
          lockAngle(body, `wrist_${side}.dev`, 0, 6),
          lockAngle(body, `clavicle_${side}.prot`, 4, 14),
          lockAngle(body, `clavicle_${side}.elev`, 2, 8),
          verticalShin(body, side, 30),
          hangByThigh(body, side, 22),
        ]),
        lockAngle(body, "lumbar.flex", -2, 22),
        lockAngle(body, "thoracic.flex", -2, 20),
        lockAngle(body, "neck.flex", 2, 8),
      ],
      keyGoals: {
        start: [
          lockAngle(body, "hip_L.flex", 12, 18),
          lockAngle(body, "hip_R.flex", 12, 18),
          ({ q, push }) => push(18 * (q[3] - rad(5))),
        ],
        end: [
          lockAngle(body, "hip_L.flex", 100, 24),
          lockAngle(body, "hip_R.flex", 100, 24),
          ({ q, push }) => push(24 * (q[3] - rad(76))),
        ],
      },
      stiffness: {
        default: 1,
        root: 8,
        hip: 14,
        knee: 10,
        ankle: 4,
        elbow: 16,
        forearm: 10,
        wrist: 8,
        shoulder: 6,
        clavicle: 12,
        lumbar: 12,
        thoracic: 10,
        neck: 6,
      },
      progress: (frame) => -anchorPoint(body, frame, "grip_L").y,
      ground: "heel_L",
      props,
      propState: (frame) => props.map((prop) => carryProp(body, frame, prop, grasps)),
      grasps,
      loads: [
        { anchor: "grip_L", share: 1, grip: "hang" },
        { anchor: "grip_R", share: 1, grip: "hang" },
      ],
      support: { kind: "standing" },
      required: SIDES.flatMap((side) =>
        (["heel", "ballIn", "ballOut", "toe"] as const).map((part) => ({
          label: `${side === "L" ? "Left" : "Right"} ${part}`,
          anchor: `${part}_${side}`,
          surfaceY: 0,
        })),
      ),
      checks: [
        ...checks,
        checkNeutralNeck(
          "Keep your neck near a neutral position, like when you are normally standing upright and looking straight ahead.",
        ),
        checkFlatBack(
          "Hinge at your hips as you keep your lower back flat, chest up, and core braced.",
          8,
        ),
      ],
      cameraHint: { view: "Side" },
    };
  },
});
