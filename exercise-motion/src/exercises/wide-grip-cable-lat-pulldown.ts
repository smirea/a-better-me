import { Quaternion, Vector3 } from "three";
import { anchorPoint, type Body, type Frame } from "../body";
import type { PropState } from "../equipment";
import type { FormCheck } from "../exercise";
import { carryProp, graspProp, gripCenter, holdGrasp } from "../grasp";
import { cableAttachment, cableEyeAt, cableTether, latPulldownMachine, propHandles } from "../machines";
import type { Vec3 } from "../math";
import { checkFeetPlanted, checkJointRange, checkJointWithinAt, checkNeutralNeck, plantBothFeet, POSTURE_HINTS, sitOnSeat } from "../postures";
import { composeExercise } from "../scene";
import { lockAngle, mirrored, type Goal } from "../solver";

const KG = 50;
/** About 1.6× shoulder width, just inside the bar's bends. */
const HAND_SPAN = 0.66;
const SEAT_Z = -0.36;
const HEEL_Z = 0.04;
const PAD_OFFSET = -0.02;
const LEAN_DEG = 14;
/** Slack taken up just short of the top, so the stack hangs a few centimetres off its rest with the arms overhead. */
const REST_CABLE = 0.22;

const bar = cableAttachment("bar", "prop-lat-bar");
const handle = propHandles("prop-lat-bar").grip;

const machine = latPulldownMachine({ thighPadOffset: PAD_OFFSET, restCable: REST_CABLE, bar: (_f, _e, states) => cableEyeAt(bar, states[0]) });
const pulley = new Vector3(...machine.pulleys!.pulley.pos);

/**
 * The bar rolls freely in closed hands, so the cable, not the palms, sets which way its eye points: turn it about its
 * own handle axis (which leaves both grips exactly where `carryProp` put them) until the eye faces the pulley.
 */
function rollEyeToPulley(state: PropState): PropState {
  const q = new Quaternion(...state.quat);
  const pos = new Vector3(...state.pos);
  const axis = new Vector3(1, 0, 0).applyQuaternion(q);
  const eye = new Vector3(0, 1, 0).applyQuaternion(q);
  const want = pulley.clone().sub(pos);
  want.addScaledVector(axis, -want.dot(axis)).normalize();
  const angle = Math.atan2(axis.clone().cross(eye).dot(want), eye.dot(want));
  const roll = new Quaternion().setFromAxisAngle(axis, angle);
  const out = roll.multiply(q);
  return { pos: state.pos, quat: [out.x, out.y, out.z, out.w] };
}

const barMid = (body: Body, frame: Frame, out = new Vector3()) =>
  gripCenter(body, frame, "L", "bar", handle.radius, out).add(gripCenter(body, frame, "R", "bar", handle.radius)).multiplyScalar(0.5);

const handSpan = (body: Body, weight: number): Goal => {
  const a = new Vector3();
  const b = new Vector3();
  return ({ frame, push }) => {
    gripCenter(body, frame, "L", "bar", handle.radius, a);
    gripCenter(body, frame, "R", "bar", handle.radius, b);
    push(weight * (a.distanceTo(b) - HAND_SPAN));
    push(weight * (a.y - b.y));
    push(weight * (a.z - b.z));
  };
};

/** Holds the torso leaning back from the hips by `deg`, measured from the hip joint to the base of the neck. */
const leanBack = (body: Body, deg: number, weight: number): Goal => {
  const t = Math.tan((deg * Math.PI) / 180);
  return ({ frame, push }) => {
    const hip = frame.pos[body.index.hip_L];
    const neck = frame.pos[body.index.neck];
    push(weight * (hip.z - neck.z - t * (neck.y - hip.y)));
  };
};

/** The bar travels straight down the cable’s line, just in front of the face, rather than arcing out and back. */
const barUnderPulley = (body: Body, weight: number): Goal => {
  const mid = new Vector3();
  return ({ frame, push }) => push(weight * (barMid(body, frame, mid).z - pulley.z));
};

/** Bar at the top of the upper chest, just clear of it. */
const barToChest = (body: Body, weight: number): Goal => {
  const mid = new Vector3();
  return ({ frame, push }) => {
    barMid(body, frame, mid);
    const chest = anchorPoint(body, frame, "chestFront");
    push(weight * (mid.y - (chest.y + 0.09)));
    push(weight * (mid.z - (chest.z + 0.05)));
  };
};

const checks = (body: Body): FormCheck[] => [
  {
    id: "bar-to-chest",
    label: "Bar reaches the upper chest",
    cue: "When pulling through your full range of motion, you should finish with the bar touching your upper chest or very close to doing so.",
    evaluate: ({ frames, bottom }) => {
      const d = barMid(body, frames[bottom]).distanceTo(anchorPoint(body, frames[bottom], "chestFront"));
      return { pass: d < 0.14, measured: `bar is ${(d * 100).toFixed(1)} cm from the upper chest at the bottom (target < 14 cm)` };
    },
  },
  checkJointWithinAt("arms-straight", "Elbows straight overhead", "Finish with your arms overhead and your elbows fully straightened.", "elbow_L.flex", "start", 0, 15),
  checkJointRange("elbows-drive-down", "Elbows drive down to the sides", "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.", "shoulder_L.elev", 70),
  {
    id: "steady-lean",
    label: "Torso keeps its slight lean",
    cue: "Maintain the slight backward lean of your torso you adopted while setting up, rather than leaning further backward.",
    evaluate: ({ frames, body: b }) => {
      const lean = frames.map((f) => {
        const hip = f.pos[b.index.hip_L];
        const neck = f.pos[b.index.neck];
        return (Math.atan2(hip.z - neck.z, neck.y - hip.y) * 180) / Math.PI;
      });
      const lo = Math.min(...lean);
      const hi = Math.max(...lean);
      return {
        pass: lo > 3 && hi < 25 && hi - lo < 8,
        measured: `torso leans back ${lo.toFixed(0)}°–${hi.toFixed(0)}° from vertical (target a steady 3°–25°, within 8°)`,
      };
    },
  },
  checkJointRange(
    "scapula-depresses",
    "Shoulder blades pull down",
    "Simultaneously pull your shoulder blades down away from your ears.",
    "clavicle_L.elev",
    8,
  ),
  checkFeetPlanted("sit down on the machine's seat with the lower portion of your thighs snugly pressed against the machine's thigh pad"),
  checkNeutralNeck("keep your neck near a neutral position"),
];

export const spec = composeExercise({
  id: "wide-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d8809d8cdbf9394bfb079c",
  name: "Wide Grip Cable Lat Pulldown",
  defaultLoadKg: KG,
  loadUnit: "total",
  machines: machine,
  setup(body, ctx) {
    const grasps = [graspProp("L", "bar", handle), graspProp("R", "bar", handle)];
    const props = [bar];
    const cable = cableTether("cable", machine, "pulley", bar, props);
    const seat = machine.surfaces!.seat;
    const s = POSTURE_HINTS.seatedLeanBack;
    const legs = { "hip.flex": 82, "knee.flex": 95, "hip.abd": 12 };
    const p: Vec3 = machine.pulleys!.pulley.pos;
    return {
      hints: {
        start: {
          ...s,
          ...legs,
          "root.z": SEAT_Z,
          "root.pitch": -12,
          "shoulder.elev": 160,
          "shoulder.plane": 40,
          "shoulder.twist": -40,
          "forearm.pron": 70,
          "elbow.flex": 4,
          "clavicle.elev": 20,
        },
        end: {
          ...s,
          ...legs,
          "root.z": SEAT_Z,
          "root.pitch": -14,
          "shoulder.elev": 70,
          "shoulder.plane": 10,
          "shoulder.twist": -60,
          "forearm.pron": 70,
          "elbow.flex": 115,
          "clavicle.elev": -5,
          "clavicle.prot": -15,
        },
      },
      goals: [
        ...sitOnSeat(body, seat.origin[1], SEAT_Z),
        ...plantBothFeet(body, 0.16, HEEL_Z, 0.15),
        handSpan(body, 30),
        // The bar is placed from the hands, so this only turns each wrist to wrap it overhand along its line.
        ...grasps.flatMap((g) => holdGrasp(body, g, ctx.live, { style: "overhand" })),
        leanBack(body, LEAN_DEG, 20),
        barUnderPulley(body, 15),
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [lockAngle(body, "elbow_L.flex", 3, 10)],
        end: [barToChest(body, 30)],
      },
      stiffness: { default: 1, lumbar: 10, thoracic: 10, neck: 4 },
      progress: (frame) => barMid(body, frame).y,
      ground: "pelvisBottom",
      props,
      propState: (frame) => [rollEyeToPulley(carryProp(body, frame, bar, grasps))],
      grasps,
      tethers: [cable.def],
      tetherState: (frame, extras, states) => [cable.state(frame, extras, states)],
      loads: [
        // One cable pulls the rigid bar, so each hand feels a force parallel to it, not one aimed at the pulley’s centre.
        { anchor: "grip_L", share: 0.5, grip: "hang", pulley: [p[0] + HAND_SPAN / 2, p[1], p[2]] },
        { anchor: "grip_R", share: 0.5, grip: "hang", pulley: [p[0] - HAND_SPAN / 2, p[1], p[2]] },
      ],
      support: { kind: "seated" },
      required: [
        { label: "Seat", anchor: "pelvisBottom", part: "lat-pulldown.seat_pad" },
        { label: "Left thigh under roller", anchor: "thighFront_L", part: "lat-pulldown.thigh_pad" },
        { label: "Right thigh under roller", anchor: "thighFront_R", part: "lat-pulldown.thigh_pad" },
        { label: "Left heel", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel", anchor: "heel_R", surfaceY: 0 },
      ],
      checks: checks(body),
      cameraHint: { view: "Side" },
    };
  },
});
