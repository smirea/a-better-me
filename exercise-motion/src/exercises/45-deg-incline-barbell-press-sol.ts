import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type PoseHints } from "../body";
import { everyFrame } from "../checks";
import { BAR_RADIUS, box, IDENTITY, olympicBar, quatEuler } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg, lerp, rad } from "../math";
import { alignBarWrists, PAD_RESTING, plantBothFeet } from "../postures";
import { lockAngle, mirrored, pin, restOnPlane, type Goal } from "../solver";

const incline = rad(45);
const seatTilt = rad(15);
const normal = new Vector3(0, Math.cos(incline), Math.sin(incline));
const seatNormal = new Vector3(0, Math.cos(seatTilt), -Math.sin(seatTilt));
const back = new Vector3(0, 0.688, -0.069);
const seat = new Vector3(0, 0.509, 0.249);
const barTop = new Vector3(0, 1.497, -0.174);
const barBottom = new Vector3(0, 1.015, -0.103);
const gripWidth = 0.65;
const common: PoseHints = {
  "root.y": 0.565,
  "root.z": 0.177,
  "root.pitch": -45,
  "hip.flex": 47,
  "hip.abd": 14,
  "hip.rot": 8,
  "knee.flex": 94,
  "forearm.pron": 78,
  "clavicle.prot": -6,
};

export const spec: ExerciseSpec = {
  id: "45-deg-incline-barbell-press-sol",
  catalogId: "1a05c6f170d880198e1aceac084f30eb",
  name: "45° Incline Barbell Press (sol)",
  defaultLoadKg: 45,
  loadUnit: "total",
  build(body) {
    const barAt = (u: number) =>
      new Vector3(
        0,
        lerp(barTop.y, barBottom.y, u),
        lerp(barTop.z, barBottom.z, u * (2.15 - 1.15 * u)),
      );
    const phase =
      (target: number): Goal =>
      ({ q, push }) =>
        push(500 * (q[body.dofCount] - target));
    const forearmUnderWrist: Goal = ({ frame, q, angles, push }) => {
      for (const side of SIDES) {
        const elbow = frame.pos[body.index[`elbow_${side}`]];
        const wrist = frame.pos[body.index[`wrist_${side}`]];
        const u = q[body.dofCount];
        const flare = 0.264 + 0.198 * Math.sin(Math.PI * 0.59 * u);
        push(48 * (elbow.z - wrist.z));
        push(27 * (elbow.x - sideSign(side) * flare));
        push(24 * Math.max(0, elbow.y - wrist.y + 0.13));
        const lockoutGuide = Math.max(0, 1 - 6 * u);
        push(24 * lockoutGuide * (angles[`elbow_${side}.flex`] - rad(7 + 310 * u)));
      }
    };
    return {
      hints: {
        start: {
          ...common,
          "shoulder.elev": 132,
          "shoulder.plane": 73,
          "shoulder.twist": 35,
          "elbow.flex": 6,
          "wrist.flex": 12,
        },
        end: {
          ...common,
          "shoulder.elev": 76,
          "shoulder.plane": 6,
          "shoulder.twist": 62,
          "elbow.flex": 105,
          "wrist.flex": 10,
        },
      },
      extras: 1,
      extraStart: [0],
      path: (u) => [u],
      goals: [
        ...plantBothFeet(body, 0.245, 0.512, 0.15, 0, 170),
        pin(body, "pelvis", () => new Vector3(0, 0.568, 0.169), 105),
        restOnPlane(body, "pelvisBottom", seat, seatNormal, 290, 0.004),
        restOnPlane(body, "upperBack", back, normal, 225, 0.004),
        restOnPlane(body, "occiput", back, normal, 180, 0.005),
        ...alignBarWrists(body, 7),
        ...SIDES.flatMap((side) => [
          pin(
            body,
            `press_${side}`,
            (q) => barAt(q[body.dofCount]).setX((sideSign(side) * gripWidth) / 2),
            170,
          ),
          lockAngle(body, `forearm_${side}.pron`, 55, 8),
          lockAngle(body, `wrist_${side}.flex`, 8, 8),
          lockAngle(body, `wrist_${side}.dev`, 0, 5),
        ]),
        forearmUnderWrist,
        mirrored(body, 12),
      ],
      keyGoals: { start: [phase(0)], end: [phase(1)] },
      stiffness: {
        default: 1,
        root: 18,
        lumbar: 18,
        thoracic: 20,
        neck: 10,
        clavicle: 12,
        forearm: 2,
        wrist: 2,
      },
      obstacles: [],
      ground: "pelvisBottom",
      progress: (frame) => anchorPoint(body, frame, "press_L").y,
      props: [olympicBar("bar")],
      propState: (_, [u]) => [{ pos: barAt(u).toArray(), quat: IDENTITY }],
      equipment: () => [
        box(
          "bench.back",
          back.clone().addScaledVector(normal, -0.031).toArray(),
          [0.3, 0.062, 1.05],
          "pad",
          true,
          quatEuler(incline, 0, 0),
        ),
        box(
          "bench.seat",
          seat.clone().addScaledVector(seatNormal, -0.031).toArray(),
          [0.3, 0.062, 0.263],
          "pad",
          true,
          quatEuler(-seatTilt, 0, 0),
        ),
        ...[-1, 1].flatMap((sign) => [
          box(`upright${sign}`, [sign * 0.59, 0.998, -0.542], [0.05, 1.202, 0.08], "steel"),
          box(`hooks${sign}`, [sign * 0.619, 1.245, -0.494], [0.039, 0.28, 0.116], "steel"),
        ]),
      ],
      glb: [{ id: "olympic-incline-bench-sol", pos: [0, 0, 0], hideEquipment: true }],
      loads: SIDES.map((side) => ({ anchor: `press_${side}`, share: 0.5, grip: "press" })),
      support: {
        kind: "lying",
        brace: true,
        passive: [
          "pelvis",
          "lumbar",
          "thoracic",
          "neck",
          ...SIDES.flatMap((side) => [`hip_${side}`, `knee_${side}`, `ankle_${side}`]),
        ],
      },
      tempo: { lower: 2.5, bottom: 0.17, raise: 2.6, top: 0.3 },
      grip: "press",
      contacts: {
        "bench.back": PAD_RESTING,
        "bench.seat": { ...PAD_RESTING, thigh_L: 0.076, thigh_R: 0.076 },
        "bar.shaft": {
          hand_L: 0.056,
          hand_R: 0.056,
          forearm_L: 0.024,
          forearm_R: 0.024,
          chest: 0.014,
          girdle: 0.009,
        },
      },
      required: [
        { label: "Glutes on seat", anchor: "pelvisBottom", part: "bench.seat" },
        { label: "Upper back on pad", anchor: "upperBack", part: "bench.back" },
        { label: "Head on pad", anchor: "occiput", part: "bench.back" },
        ...SIDES.flatMap((side) => [
          { label: `${side} heel stays planted`, anchor: `heel_${side}`, surfaceY: 0 },
          { label: `${side} forefoot stays planted`, anchor: `ballIn_${side}`, surfaceY: 0 },
          { label: `${side} palm on bar`, anchor: `press_${side}`, prop: "bar" },
        ]),
      ],
      checks: [
        {
          id: "five-points",
          label: "Five points of support",
          cue: "Your feet should be firmly dug into the ground, while your buttocks, upper back, and head are firmly planted on the bench.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) =>
                100 *
                Math.max(
                  ...SIDES.map((side) => Math.abs(anchorPoint(body, frame, `heel_${side}`).y)),
                  ...["upperBack", "occiput"].map((anchor) =>
                    Math.abs(anchorPoint(body, frame, anchor).sub(back).dot(normal)),
                  ),
                  Math.abs(anchorPoint(body, frame, "pelvisBottom").sub(seat).dot(seatNormal)),
                ),
              1.5,
              " cm from support",
            ),
        },
        {
          id: "upper-chest",
          label: "Bar touches upper chest",
          cue: "Descend until you are able to tap your upper chest lightly with the bar.",
          evaluate: ({ frames, sequence, bottom }) => {
            const front = anchorPoint(body, frames[bottom], "frontRack_L");
            const bar = new Vector3(...sequence.propStates[bottom][0].pos).setX(front.x);
            const gap = bar.distanceTo(front) - BAR_RADIUS;
            return {
              pass: Math.abs(gap) <= 0.04,
              measured: `${(gap * 100).toFixed(1)} cm from upper chest`,
            };
          },
        },
        {
          id: "stack",
          label: "Wrists stacked over elbows",
          cue: "Strive to keep your elbows stacked underneath (when viewed from the side) your mostly straight wrists.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) =>
                100 *
                Math.max(
                  ...SIDES.map((side) =>
                    Math.abs(
                      frame.pos[body.index[`wrist_${side}`]].z -
                        frame.pos[body.index[`elbow_${side}`]].z,
                    ),
                  ),
                ),
              6,
              " cm side-view offset",
            ),
        },
        {
          id: "flare",
          label: "Moderate elbow flare at the bottom",
          cue: "Near the bottom of the rep, the proper balance should result in your upper arms forming approximately 45-75-degree angles with your torso.",
          evaluate: ({ frames, bottom }) => {
            const frame = frames[bottom];
            const chestDown = new Vector3(0, -1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
            const upper = frame.pos[body.index.elbow_L]
              .clone()
              .sub(frame.pos[body.index.shoulder_L]);
            const flare = deg(upper.angleTo(chestDown));
            return { pass: flare >= 45 && flare <= 75, measured: `${flare.toFixed(1)}°` };
          },
        },
        {
          id: "lockout",
          label: "Bar over shoulders at lockout",
          cue: "You should finish with your elbows fully straightened and the bar situated above your shoulders.",
          evaluate: ({ frames, angles, sequence, top }) => {
            const bend = deg(angles[top]["elbow_L.flex"]);
            const offset = Math.abs(
              sequence.propStates[top][0].pos[2] - frames[top].pos[body.index.shoulder_L].z,
            );
            return {
              pass: bend < 10 && offset < 0.085,
              measured: `${bend.toFixed(1)}° elbow bend, ${(offset * 100).toFixed(1)} cm offset`,
            };
          },
        },
      ],
    };
  },
};
