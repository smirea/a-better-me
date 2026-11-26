import { Vector3 } from "three";
import { anchorPoint, clavicleRhythm, SIDES, worldPoint, type Body, type Frame } from "../body";
import { everyFrame } from "../checks";
import type { CheckContext, FormCheck } from "../exercise";
import { carryProp, graspProp, holdGrasp } from "../grasp";
import { deg, rad } from "../math";
import {
  cableAttachment,
  cableEyeAt,
  cableTether,
  latPulldownMachine,
  propHandles,
} from "../machines";
import { plantBothFeet, sitOnSeat } from "../postures";
import { composeExercise } from "../scene";
import { lockAngle, mirrored, restOnPlane, type Goal } from "../solver";

const LOAD_KG = 50;
/** Thigh rollers lowered onto the seated thighs. */
const THIGH_PAD = -0.05;
/**
 * Cable length, pulley to the bar's eye, with the stack on its pin. It is shorter than the lifter's reach at the
 * top, so the stack hangs off its pin through the whole rep: a cable left slack at the top would carry nothing
 * there, whatever weight is selected.
 */
const REST_CABLE = 0.28;
/**
 * Half the grip width: the hands sit on the straight part of the bar at one and a half times shoulder width, as in
 * the catalog's photos and the grip studies call wide (Andersen et al., 2014), not out on the cranked ends.
 */
const GRIP = 0.31;
/** How far the cranked bar's eye rides above the grips. */
const EYE_ABOVE_GRIPS = 0.07;
const bar = cableAttachment("bar", "prop-lat-bar");
const handles = propHandles("prop-lat-bar");

/** Where the bar finishes: the top of the chest under the collarbones, in the thorax's frame. */
const UPPER_CHEST = new Vector3(0, 0.225, 0.135);
const upperChest = (body: Body, frame: Frame, out = new Vector3()) =>
  worldPoint(frame, body.index.thoracic, UPPER_CHEST, out);

/** Pulls both hands of the wide grip to the upper chest, the bar just clear of it. End key only. */
function handsAtChest(body: Body, weight: number): Goal {
  const hand = new Vector3();
  const chest = new Vector3();
  return ({ frame, push }) => {
    upperChest(body, frame, chest);
    for (const side of SIDES) {
      anchorPoint(body, frame, `grip_${side}`, hand);
      push(weight * (hand.y - chest.y));
      push(weight * (hand.z - (chest.z + 0.02)));
    }
  };
}

/** The stack is off its pin at the top: the bar hangs more than the resting cable's length from the pulley. Start key only. */
function cableTaut(body: Body, pulley: readonly number[], weight: number): Goal {
  const left = new Vector3();
  const right = new Vector3();
  return ({ frame, push }) => {
    anchorPoint(body, frame, "grip_L", left);
    anchorPoint(body, frame, "grip_R", right);
    // The bar is cranked: its eye sits above and just in front of the line between the hands.
    const y = (left.y + right.y) / 2 + EYE_ABOVE_GRIPS - pulley[1];
    const z = (left.z + right.z) / 2 - pulley[2];
    push(weight * Math.min(0, Math.hypot(y, z) - REST_CABLE - 0.02));
  };
}

const torsoUp = new Vector3();

/** How far the torso leans back, in radians. */
function torsoLean(body: Body, frame: Frame) {
  torsoUp.set(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
  return Math.atan2(-torsoUp.z, torsoUp.y);
}

/** Holds the torso's backward lean inside a range of degrees, and leaves it alone there. */
function leanWithin(body: Body, lo: number, hi: number, weight: number): Goal {
  return ({ frame, push }) => {
    const lean = deg(torsoLean(body, frame));
    push(weight * rad(Math.max(0, lo - lean) + Math.max(0, lean - hi)));
  };
}

/** The bar stays in front of the upper chest: it can touch it and never pass into it. */
function barClearOfChest(body: Body, weight: number): Goal {
  const hand = new Vector3();
  const chest = new Vector3();
  return ({ frame, push }) => {
    upperChest(body, frame, chest);
    for (const side of SIDES) {
      anchorPoint(body, frame, `grip_${side}`, hand);
      push(weight * Math.min(0, hand.z - (chest.z + 0.02)));
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

/** How far the gripped part of the bar finishes from the upper chest. The bar is cranked, so its middle rides higher. */
function barToChest(context: CheckContext, index: number): number {
  const frame = context.frames[index];
  const chest = upperChest(context.body, frame);
  const left = anchorPoint(context.body, frame, "grip_L");
  const right = anchorPoint(context.body, frame, "grip_R");
  return Math.hypot((left.y + right.y) / 2 - chest.y, (left.z + right.z) / 2 - chest.z);
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
    evaluate: ({ body, frames, angles, top }) => {
      const a = angles[top];
      const elbow = Math.max(deg(a["elbow_L.flex"]), deg(a["elbow_R.flex"]));
      const forward = Math.max(...SIDES.map((side) => armForward(body, frames[top], side)));
      return {
        pass: elbow <= 15 && forward >= 5 && forward <= ARMS_FORWARD,
        measured: `elbows ${elbow.toFixed(0)}°, arms ${forward.toFixed(0)}° forward of straight up at the top`,
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

/** The slight backward lean the instructions ask for, in degrees. Where in it the torso sits is the lifter's choice. */
const LEAN_RANGE = [7, 17];
const LEAN = 10;
/**
 * The most the arms reach forward of straight up at the top, in degrees, seen from the side. The cue is about the
 * room, not the ribcage: measured against a leaned-back torso, the same arms read lower and get dragged behind
 * the cable.
 */
const ARMS_FORWARD = 30;

/** How far forward of straight up an arm points, in degrees, seen from the side. */
function armForward(body: Body, frame: Frame, side: "L" | "R") {
  const shoulder = frame.pos[body.index[`shoulder_${side}`]];
  const grip = anchorPoint(body, frame, `grip_${side}`);
  return deg(Math.atan2(grip.z - shoulder.z, grip.y - shoulder.y));
}
const SEAT_Z = 0.18;

const up = {
  "root.pitch": -LEAN - 1,
  "hip.flex": 100,
  "hip.abd": 6,
  "hip.rot": 4,
  "knee.flex": 78,
  "ankle.dorsi": 4,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 0,
  "clavicle.prot": -4,
  "shoulder.elev": 140,
  "shoulder.plane": 48,
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
    const gL = graspProp("L", "bar", handles.grip);
    const gR = graspProp("R", "bar", handles.grip);
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
      "forearm.pron": 75,
      "wrist.flex": 0,
      "wrist.dev": -6,
    };
    return {
      hints: {
        start: { ...up, "root.y": seat.origin[1] + 0.09, "root.z": seat.origin[2] + SEAT_Z },
        end: { ...down, "root.y": seat.origin[1] + 0.08, "root.z": seat.origin[2] + SEAT_Z },
      },
      goals: [
        ...plantBothFeet(body, 0.16, 0.04, 0.1, 0, 80),
        ...sitOnSeat(body, seat.origin[1], seat.origin[2] + SEAT_Z, 0.006, 400),
        restOnPlane(body, "thighFront_L", new Vector3(...padL.origin), new Vector3(...padL.normal), 50, 0.004),
        restOnPlane(body, "thighFront_R", new Vector3(...padR.origin), new Vector3(...padR.normal), 50, 0.004),
        leanWithin(body, LEAN_RANGE[0], LEAN_RANGE[1], 300),
        lockAngle(body, "hip_L.flex", 92, 12),
        lockAngle(body, "hip_R.flex", 92, 12),
        lockAngle(body, "knee_L.flex", 78, 10),
        lockAngle(body, "knee_R.flex", 78, 10),
        lockAngle(body, "ankle_L.dorsi", 2, 14),
        lockAngle(body, "ankle_R.dorsi", 2, 14),
        mirrored(body, 40),
        barClearOfChest(body, 300),
        claviclesWithArms(36),
        ...holdGrasp(body, gL, ctx.live, { style: "overhand", weight: 90, align: 16, wrist: 1, at: GRIP }),
        ...holdGrasp(body, gR, ctx.live, { style: "overhand", weight: 90, align: 16, wrist: 1, at: -GRIP }),
        lockAngle(body, "lumbar.flex", -3, 20),
        lockAngle(body, "thoracic.flex", -3, 20),
        lockAngle(body, "neck.flex", 0, 6),
      ],
      effort: true,
      steady: [(frame) => torsoLean(body, frame)],
      keyGoals: {
        start: [
          cableTaut(body, pulley, 300),
          // "Arms overhead and slightly forward".
          ({ frame, push }) => {
            for (const side of SIDES)
              push(120 * rad(Math.max(0, armForward(body, frame, side) - ARMS_FORWARD)));
          },
          lockAngle(body, "elbow_L.flex", 5, 30),
          lockAngle(body, "elbow_R.flex", 5, 30),
        ],
        end: [
          handsAtChest(body, 300),
        ],
      },
      stiffness: { default: 0.3, root: 0.3 },
      extras: 0,
      extraStart: [],
      progress: (frame) => -anchorPoint(body, frame, "grip_L").y,
      ground: "pelvisBottom",
      props: [bar],
      propState: (frame) => [carry(body, frame, [pulley[0], pulley[1], pulley[2]])],
      grasps: [gL, gR],
      tethers: [cable.def],
      tetherState: (frame, extras, propStates) => [cable.state(frame, extras, propStates)],
      loads: [
        { anchor: "grip_L", share: 0.5, grip: "hang", pulley: [GRIP, pulley[1], pulley[2]] },
        { anchor: "grip_R", share: 0.5, grip: "hang", pulley: [-GRIP, pulley[1], pulley[2]] },
      ],
      support: { kind: "seated", passive: ["hip", "knee", "ankle"], bars: [["grip_L", "grip_R"]] },
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
    graspProp("L", "bar", handles.grip),
    graspProp("R", "bar", handles.grip),
  ], { toward: pulley });
}
