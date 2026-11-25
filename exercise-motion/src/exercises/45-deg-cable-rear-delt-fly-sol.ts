import { Quaternion, Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Frame, type PoseHints, type Side } from "../body";
import { everyFrame } from "../checks";
import { box, IDENTITY, sphere } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg } from "../math";
import { pin, plantFoot } from "../solver";

const pulley = (side: Side) => new Vector3(sideSign(side) * 0.609, 1.831, 0.004);
const handleId = (side: Side) => `handle${side}`;
function armHints(side: Side, upper: Vector3, lower: Vector3): PoseHints {
  const sign = sideSign(side);
  upper.x *= sign;
  lower.x *= sign;
  upper.normalize();
  lower.normalize();
  const down = new Vector3(0, -1, 0);
  const swing = new Quaternion().setFromUnitVectors(down, upper);
  const bend = lower.clone().applyQuaternion(swing.invert());
  return {
    [`shoulder_${side}.elev`]: deg(down.angleTo(upper)),
    [`shoulder_${side}.plane`]: deg(Math.atan2(upper.z, sign * upper.x)),
    [`shoulder_${side}.twist`]: -sign * deg(Math.atan2(bend.x, bend.z)),
    [`elbow_${side}.flex`]: deg(upper.angleTo(lower)),
  };
}

export const spec: ExerciseSpec = {
  id: "45-deg-cable-rear-delt-fly-sol",
  catalogId: "2a15c6f170d88066b38fd65f8757716f",
  name: "45° Cable Rear Delt Fly (sol)",
  defaultLoadKg: 4,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  build(body) {
    const hand = (frame: Frame, side: Side) => anchorPoint(body, frame, `grip_${side}`);
    const common = {
      "root.z": 0.55,
      "root.yaw": 180,
      "root.y": 0.936,
      "hip.abd": 8,
      "hip.flex": 4,
      "knee.flex": 5,
      "forearm.pron": -25,
    };
    const start = {
      ...common,
      "clavicle_L.prot": -7,
      "clavicle_R.prot": 12,
      ...armHints("L", new Vector3(-0.119, -0.209, 0.97), new Vector3(-0.507, 0.446, 0.738)),
      ...armHints("R", new Vector3(-0.108, -0.184, 0.977), new Vector3(-0.532, 0.331, 0.79)),
    };
    const end = {
      ...common,
      "shoulder.elev": 44,
      "shoulder.plane": -20,
      "shoulder.twist": -81,
      "elbow.flex": 24,
    };
    const arm = (frame: Frame, joint: string, side: Side) =>
      frame.pos[body.index[`${joint}_${side}`]];
    return {
      hints: { start, end },
      extras: 0,
      extraStart: [],
      keyGoals: {
        start: [],
        end: SIDES.flatMap((side) => [
          pin(body, `elbow_${side}`, () => new Vector3(-sideSign(side) * 0.43, 1.21, 0.63), 50),
          pin(body, `grip_${side}`, () => new Vector3(-sideSign(side) * 0.65, 0.995, 0.686), 120),
        ]),
      },
      goals: [
        ...SIDES.flatMap((side) =>
          plantFoot(
            body,
            side,
            new Vector3(-sideSign(side) * 0.155, 0, 0.629),
            Math.PI + 0.13,
            160,
          ),
        ),
        pin(body, "pelvis", () => new Vector3(0, 0.936, 0.55), 160),
        pin(body, "neck", () => new Vector3(0, 1.496, 0.57), 160),
      ],
      stiffness: {
        default: 3,
        root: 8,
        lumbar: 10,
        thoracic: 10,
        neck: 9,
        clavicle: 8,
        shoulder: 32,
        elbow: 32,
        wrist: 8,
      },
      obstacles: [],
      ground: "heel_L",
      // Hand width peaks before the end of the sweep. Time the curved path by pose fraction.
      progress: () => 0,
      props: SIDES.map((side) => ({
        id: handleId(side),
        kind: "parts",
        parts: [sphere(`${handleId(side)}.stop`, [0, 0, 0], 0.022, "rubber")],
      })),
      propState: (frame) =>
        SIDES.map((side) => ({ pos: hand(frame, side).toArray(), quat: IDENTITY })),
      tethers: SIDES.map((side) => ({ id: `cable${side}`, kind: "cable", radius: 0.003 })),
      tetherState: (_, __, props) =>
        SIDES.map((side, i) => ({
          points: [pulley(side).toArray(), props[i].pos],
        })),
      equipment: () =>
        [-1, 1].flatMap((sign) => [
          box(`tower${sign}`, [sign * 0.525, 1.1, -0.78], [0.38, 1.7, 0.67], "steel"),
          box(`guide${sign}`, [sign * 0.692, 1.12, -0.18], [0.075, 2.16, 0.075], "steel"),
          box(`base${sign}`, [sign * 0.5, 0.046, -0.61], [0.4, 0.092, 1.04], "steel"),
        ]),
      glb: [
        {
          id: "dual-adjustable-pulley-sol",
          pos: [0, 0, 0],
          quat: [0, 1, 0, 0],
          hideEquipment: true,
        },
      ],
      loads: SIDES.map((side) => ({
        anchor: `grip_${side}`,
        share: 1,
        grip: "hang",
        pulley: pulley(side).toArray(),
      })),
      support: { kind: "standing", brace: true },
      tempo: { lower: 1.55, bottom: 0.24, raise: 1.95, top: 0.22 },
      phaseLabels: ["Sweep", "Squeeze", "Return", "Crossed"],
      grip: "hang",
      contacts: Object.fromEntries(
        SIDES.map((side) => [
          handleId(side),
          { [`hand_${side}`]: 0.06, [`forearm_${side}`]: 0.018 },
        ]),
      ),
      required: SIDES.flatMap((side) => [
        { label: `${side} heel`, anchor: `heel_${side}`, surfaceY: 0 },
        { label: `${side} forefoot`, anchor: `ballIn_${side}`, surfaceY: 0 },
        { label: `${side} cable grip`, anchor: `grip_${side}`, prop: handleId(side) },
      ]),
      checks: [
        {
          id: "cross",
          label: "Crossed hands above shoulders",
          cue: "Your arms should resemble an “X-shape” with each other as your hands are above shoulder height in line with the resistance from the cables.",
          evaluate: ({ frames, top }) => {
            const frame = frames[top];
            const crossed = hand(frame, "L").x - hand(frame, "R").x;
            const rise = Math.min(
              ...SIDES.map((side) => hand(frame, side).y - arm(frame, "shoulder", side).y),
            );
            return {
              pass: crossed > 0.065 && rise > 0.035,
              measured: `${(crossed * 100).toFixed(1)} cm overlap, ${(rise * 100).toFixed(1)} cm above shoulders`,
            };
          },
        },
        {
          id: "soft-elbows",
          label: "Soft elbows throughout",
          cue: "Maintain slightly bent elbows throughout your set.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_, angles) =>
                Math.max(...SIDES.map((side) => Math.abs(deg(angles[`elbow_${side}.flex`]) - 32))),
              25,
              "° from 32°",
            ),
        },
        {
          id: "diagonal",
          label: "Hands sweep out, down, and back",
          cue: "Strive to achieve a roughly even balance between sweeping horizontally outward and vertically downward.",
          evaluate: ({ frames, top, bottom }) => {
            const start = hand(frames[top], "L");
            const end = hand(frames[bottom], "L");
            const angle = deg(Math.atan2(start.y - end.y, start.x - end.x));
            const back = end.z - start.z;
            return {
              pass: angle >= 30 && angle <= 55 && back > 0.4,
              measured: `${angle.toFixed(1)}° down, ${(back * 100).toFixed(1)} cm back`,
            };
          },
        },
        {
          id: "retraction",
          label: "Elbows reach the shoulders' vertical plane",
          cue: "Your elbows should be slightly behind your shoulders or at least horizontally level with your shoulders at the end range.",
          evaluate: ({ frames, bottom }) => {
            const frame = frames[bottom];
            const back = Math.min(
              ...SIDES.map((side) => arm(frame, "elbow", side).z - arm(frame, "shoulder", side).z),
            );
            return {
              pass: back >= -0.012,
              measured: `${(back * 100).toFixed(1)} cm behind shoulders`,
            };
          },
        },
        {
          id: "upright",
          label: "Torso stays upright",
          cue: "Keep your torso upright with your chest up throughout the set.",
          evaluate: (context) =>
            everyFrame(
              context,
              (f) =>
                (f.pos[body.index.neck]
                  .clone()
                  .sub(f.pos[body.index.pelvis])
                  .angleTo(new Vector3(0, 1, 0)) *
                  180) /
                Math.PI,
              5,
              "° from vertical",
            ),
        },
      ],
    };
  },
};
