import { Vector3 } from "three";
import { anchorPoint, clavicleRhythm, SIDES, type Body, type Frame } from "../body";
import { everyFrame } from "../checks";
import type { CheckContext, FormCheck } from "../exercise";
import { carryProp, graspProp, holdGrasp, keepGraspSpan } from "../grasp";
import { deg, rad } from "../math";
import {
  cableAttachment,
  cableEyeAt,
  cableTether,
  latPulldownMachine,
  propHandles,
} from "../machines";
import { plantBothFeet, sitOnSeat } from "../postures";
import { lockTorsoPitch } from "../authoring";
import { composeExercise } from "../scene";
import { lockAngle, mirrored, restOnPlane, type Goal } from "../solver";

const LOAD_KG = 25;
/** Thigh rollers lowered onto the seated thighs. */
const THIGH_PAD = -0.05;
/**
 * Cable length at the top, pulley to the bar's eye. The stack rests on its pin there and rises as the bar comes down.
 */
const REST_CABLE = 0.38;
const bar = cableAttachment("bar", "prop-lat-bar");
const handles = propHandles("prop-lat-bar");

function pitchGoal(targetDeg: number, weight: number): Goal {
  const target = rad(targetDeg);
  return ({ q, push }) => push(weight * (q[3] - target));
}

/** Pulls both hands of the wide grip to chest depth and chest height. End key only. */
function handsAtChest(body: Body, weight: number): Goal {
  const hand = new Vector3();
  const chest = new Vector3();
  return ({ frame, push }) => {
    anchorPoint(body, frame, "chestFront", chest);
    for (const side of SIDES) {
      anchorPoint(body, frame, `grip_${side}`, hand);
      push(weight * (hand.y - (chest.y - 0.02)));
      push(weight * (hand.z - chest.z));
    }
  };
}

/** Overhead hands sit just in front of the face, under the pulley, instead of behind the head. Start key only. */
function handsForward(body: Body, z: number, weight: number): Goal {
  const hand = new Vector3();
  return ({ frame, push }) => {
    for (const side of SIDES) {
      anchorPoint(body, frame, `grip_${side}`, hand);
      push(weight * (hand.z - z));
    }
  };
}

/** Keeps a hand from slipping behind the chest. Zero once the hand is in front of it. */
function notBehindChest(body: Body, weight: number): Goal {
  const hand = new Vector3();
  const chest = new Vector3();
  return ({ frame, push }) => {
    anchorPoint(body, frame, "chestFront", chest);
    for (const side of SIDES) {
      anchorPoint(body, frame, `grip_${side}`, hand);
      push(weight * Math.min(0, hand.z - chest.z));
    }
  };
}

/**
 * Brings both hands to the upper chest in step with the rep, not with the elbow angle. Gating on the elbow
 * made the pull bistable: once the elbow passed the threshold the pull snapped the arm the rest of the way,
 * and the two sides disagreed because both were scaled by the left elbow. The extra (q past the body) is the
 * rep phase, held by the sample prior, so the pull grows smoothly and the same amount on both sides.
 */
function pullDownToChest(body: Body, weight: number): Goal {
  const hand = new Vector3();
  const chest = new Vector3();
  return ({ frame, q, push }) => {
    const t = Math.min(1, Math.max(0, q[body.dofCount] ?? 0));
    const bend = t * t * (3 - 2 * t);
    anchorPoint(body, frame, "chestFront", chest);
    for (const side of SIDES) {
      anchorPoint(body, frame, `grip_${side}`, hand);
      push(weight * bend * (hand.y - (chest.y - 0.03)));
      push(weight * 1.5 * bend * (hand.z - (chest.z + 0.01)));
    }
  };
}

/** Scapulohumeral rhythm: the collarbones rise with the arms and drop as the bar comes down. */
function claviclesWithArms(weight: number): Goal {
  return ({ angles: a, push }) => {
    for (const side of SIDES) {
      const want = rad(clavicleRhythm(deg(a[`shoulder_${side}.elev`])));
      push(weight * (a[`clavicle_${side}.elev`] - want));
    }
  };
}

function barToChest(context: CheckContext, index: number): number {
  const frame = context.frames[index];
  const chest = anchorPoint(context.body, frame, "chestFront");
  const pos = context.sequence.propStates[index][0].pos;
  return Math.hypot(pos[0] - chest.x, pos[1] - chest.y, pos[2] - chest.z);
}

const checks: FormCheck[] = [
  {
    id: "lean",
    label: "Slight backward lean, held",
    cue: "In the seated position, slightly lean your torso backward at your hips. Maintain this slight backward lean throughout your set, rather than leaning further backward.",
    evaluate: (context) =>
      everyFrame(context, (frame) => {
        // The torso's lean, not the pelvis's: the upper back is what a coach sees rock back.
        const up = new Vector3(0, 1, 0).applyQuaternion(frame.rot[context.body.index.thoracic]);
        const lean = deg(Math.atan2(-up.z, up.y));
        return Math.max(0, 6 - lean, lean - 18);
      }, 0, "° outside a slight backward lean"),
  },
  {
    id: "arms-up",
    label: "Arms overhead, elbows straight",
    cue: "From this position, your elbows should be straight, with your arms overhead and slightly forward (rather than completely vertical).",
    evaluate: ({ angles, top }) => {
      const a = angles[top];
      const elbow = Math.max(deg(a["elbow_L.flex"]), deg(a["elbow_R.flex"]));
      const elev = Math.min(deg(a["shoulder_L.elev"]), deg(a["shoulder_R.elev"]));
      return {
        pass: elbow <= 15 && elev >= 130,
        measured: `elbows ${elbow.toFixed(0)}°, arms ${elev.toFixed(0)}° up at the top`,
      };
    },
  },
  {
    id: "bar-to-chest",
    label: "Bar reaches the upper chest",
    cue: "When pulling through your full range of motion, you should finish with the bar touching your upper chest or very close to doing so.",
    evaluate: (context) => {
      const gap = barToChest(context, context.bottom) * 100;
      return { pass: gap <= 8, measured: `bar finishes ${gap.toFixed(1)} cm from the upper chest` };
    },
  },
  {
    id: "elbows-down",
    label: "Elbows drive down",
    cue: "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
    evaluate: ({ body, frames, angles, bottom }) => {
      const a = angles[bottom];
      const elbow = Math.min(deg(a["elbow_L.flex"]), deg(a["elbow_R.flex"]));
      let below = Infinity;
      for (const side of SIDES) {
        const drop =
          frameY(body, frames[bottom], `shoulder_${side}`) - frameY(body, frames[bottom], `elbow_${side}`);
        below = Math.min(below, drop);
      }
      return {
        pass: elbow >= 70 && below >= 0.02,
        measured: `elbows bend ${elbow.toFixed(0)}° and finish ${(below * 100).toFixed(0)} cm below the shoulders`,
      };
    },
  },
  {
    id: "scapulae-down",
    label: "Shoulder blades pull down",
    cue: "Simultaneously pull your shoulder blades down away from your ears.",
    evaluate: ({ angles, top, bottom }) => {
      const start = Math.max(deg(angles[top]["clavicle_L.elev"]), deg(angles[top]["clavicle_R.elev"]));
      const peak = Math.max(deg(angles[bottom]["clavicle_L.elev"]), deg(angles[bottom]["clavicle_R.elev"]));
      return {
        pass: peak <= start - 8,
        measured: `shoulder blades finish ${(start - peak).toFixed(0)}° lower than at the top`,
      };
    },
  },
  {
    id: "feet-flat",
    label: "Feet stay flat",
    cue: "Adjust the thigh pad to a height that lets you position your thighs snugly against it while sitting with your feet flat on the floor.",
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
];

function frameY(body: Body, frame: Frame, joint: string): number {
  return frame.pos[body.index[joint]].y;
}

const up = {
  "root.pitch": -14,
  "hip.flex": 100,
  "hip.abd": 6,
  "hip.rot": 4,
  "knee.flex": 78,
  "ankle.dorsi": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 0,
  "clavicle.prot": -4,
  "shoulder.elev": 152,
  "shoulder.plane": 40,
  "shoulder.twist": 8,
  "elbow.flex": 6,
  "forearm.pron": 45,
  "wrist.flex": 6,
  "wrist.dev": -4,
};

export const spec = composeExercise({
  id: "wide-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d8809d8cdbf9394bfb079c",
  name: "Wide Grip Cable Lat Pulldown",
  defaultLoadKg: LOAD_KG,
  loadUnit: "total",
  machines: () =>
    latPulldownMachine({
      thighPadOffset: THIGH_PAD,
      restCable: REST_CABLE,
      bar: (_frame, _extras, propStates) => cableEyeAt(bar, propStates[0]),
    }),
  setup(body, ctx) {
    const machine = ctx.machine!;
    const seat = machine.surfaces!.seat;
    const padL = machine.surfaces!.thigh_pad_L;
    const padR = machine.surfaces!.thigh_pad_R;
    const pulley = machine.pulleys!.pulley.pos;
    const gL = graspProp("L", "bar", handles.grip_L);
    const gR = graspProp("R", "bar", handles.grip_R);
    const cable = cableTether(
      "cable",
      machine as unknown as Parameters<typeof cableTether>[1],
      "pulley",
      bar,
      [bar],
    );
    const down = {
      ...up,
      "clavicle.elev": 2,
      "shoulder.elev": 30,
      "shoulder.plane": 35,
      "shoulder.twist": 10,
      "elbow.flex": 108,
      "forearm.pron": 30,
      "wrist.flex": 0,
      "wrist.dev": -6,
    };
    return {
      hints: {
        start: { ...up, "root.y": seat.origin[1] + 0.09, "root.z": seat.origin[2] + 0.18 },
        end: { ...down, "root.y": seat.origin[1] + 0.08, "root.z": seat.origin[2] + 0.18 },
      },
      goals: [
        ...plantBothFeet(body, 0.16, 0.04, 0.1, 0, 80),
        ...sitOnSeat(body, seat.origin[1], seat.origin[2] + 0.18, 0.006, 150),
        restOnPlane(body, "thighFront_L", new Vector3(...padL.origin), new Vector3(...padL.normal), 50, 0.004),
        restOnPlane(body, "thighFront_R", new Vector3(...padR.origin), new Vector3(...padR.normal), 50, 0.004),
        pitchGoal(-14, 90),
        lockTorsoPitch(body, -13, 60),
        lockAngle(body, "hip_L.flex", 92, 12),
        lockAngle(body, "hip_R.flex", 92, 12),
        lockAngle(body, "knee_L.flex", 78, 10),
        lockAngle(body, "knee_R.flex", 78, 10),
        lockAngle(body, "ankle_L.dorsi", 2, 14),
        lockAngle(body, "ankle_R.dorsi", 2, 14),
        mirrored(body, 40),
        notBehindChest(body, 28),
        pullDownToChest(body, 110),
        claviclesWithArms(36),
        ...holdGrasp(body, gL, ctx.live, { style: "overhand", weight: 90, align: 16, wrist: 1.4 }),
        ...holdGrasp(body, gR, ctx.live, { style: "overhand", weight: 90, align: 16, wrist: 1.4 }),
        keepGraspSpan(body, gL, gR, bar, 240),
        lockAngle(body, "lumbar.flex", -4, 30),
        lockAngle(body, "thoracic.flex", -2, 30),
        lockAngle(body, "neck.flex", 0, 6),
        lockAngle(body, "clavicle_L.prot", -14, 40),
        lockAngle(body, "clavicle_R.prot", -14, 40),
      ],
      keyGoals: {
        start: [
          handsForward(body, pulley[2] + 0.04, 36),
          lockAngle(body, "elbow_L.flex", 6, 16),
          lockAngle(body, "elbow_R.flex", 6, 16),
          lockAngle(body, "shoulder_L.elev", 152, 12),
          lockAngle(body, "shoulder_R.elev", 152, 12),
          lockAngle(body, "shoulder_L.plane", 40, 8),
          lockAngle(body, "shoulder_R.plane", 40, 8),
        ],
        end: [
          handsAtChest(body, 160),
          lockAngle(body, "elbow_L.flex", 108, 8),
          lockAngle(body, "elbow_R.flex", 108, 8),
          lockAngle(body, "shoulder_L.elev", 32, 6),
          lockAngle(body, "shoulder_R.elev", 32, 6),
          lockAngle(body, "shoulder_L.plane", 30, 6),
          lockAngle(body, "shoulder_R.plane", 30, 6),
        ],
      },
      stiffness: {
        default: 2,
        root: 24,
        hip: 16,
        knee: 10,
        ankle: 4,
        lumbar: 24,
        thoracic: 24,
        neck: 6,
        clavicle: 14,
        shoulder: 40,
        elbow: 40,
        forearm: 6,
        wrist: 16,
      },
      extras: 1,
      extraStart: [0],
      path: (s) => [s],
      progress: (frame) => -anchorPoint(body, frame, "grip_L").y,
      ground: "pelvisBottom",
      props: [bar],
      propState: (frame) => [carry(body, frame, [pulley[0], pulley[1], pulley[2]])],
      grasps: [gL, gR],
      tethers: [cable.def],
      tetherState: (frame, extras, propStates) => [cable.state(frame, extras, propStates)],
      loads: [
        { anchor: "grip_L", share: 0.5, grip: "hang", pulley: [0.52, pulley[1], pulley[2]] },
        { anchor: "grip_R", share: 0.5, grip: "hang", pulley: [-0.52, pulley[1], pulley[2]] },
      ],
      support: { kind: "seated", passive: ["hip", "knee", "ankle"] },
      required: [
        { label: "Seat", anchor: "pelvisBottom", part: "lat-pulldown.seat_pad" },
        { label: "Left thigh", anchor: "thighFront_L", prop: "lat-pulldown.thigh_pad" },
        { label: "Right thigh", anchor: "thighFront_R", prop: "lat-pulldown.thigh_pad" },
        ...SIDES.flatMap((side) =>
          (["heel", "ballIn", "ballOut", "toe"] as const).map((part) => ({
            label: `${side === "L" ? "Left" : "Right"} ${part}`,
            anchor: `${part}_${side}`,
            surfaceY: 0,
          })),
        ),
      ],
      checks,
    };
  },
});

function carry(body: Body, frame: Frame, pulley: readonly [number, number, number]) {
  return carryProp(body, frame, bar, [
    graspProp("L", "bar", handles.grip_L),
    graspProp("R", "bar", handles.grip_R),
  ], { toward: pulley });
}
