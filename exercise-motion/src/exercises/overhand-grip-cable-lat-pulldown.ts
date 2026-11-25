import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, worldPoint, type Body, type Frame } from "../body";
import { everyFrame, within } from "../checks";
import { cableAttachmentProp, compileParts, latPulldownMachine } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg, rad } from "../math";
import { aim, type Goal, lockAngle, mirrored, pin, plantFoot } from "../solver";

const SEAT_Y = 0.44;
const SINK = 0.01;
const SEAT_Z = -0.02;
const THIGH_PAD_Y = 0.61;
const THIGH_PAD_Z = 0.24;
const THIGH_PAD_R = 0.055;
const PULLEY_Z = 0.2;
const GRIP_X = 0.3;
const HEEL_X = 0.16;
const HEEL_Z = 0.32;
const TOE_OUT = rad(8);
const LEAN = -14;
const BAR_R = 0.015;
const REACH = 0.63;

const seatAllow = {
  pelvis: 0.028,
  abdomen: 0.012,
  thigh_L: 0.024,
  thigh_R: 0.024,
};
const thighAllow = {
  thigh_L: 0.032,
  thigh_R: 0.032,
};

export const spec: ExerciseSpec = {
  id: "overhand-grip-cable-lat-pulldown",
  catalogId: "1a15c6f170d8800d8fc9d2c235673bf6",
  name: "Overhand Grip Cable Lat Pulldown",
  defaultLoadKg: 45,
  loadUnit: "total",
  laterality: "bilateral",
  build(body: Body) {
    const barY = body.dofCount;
    const barZ = body.dofCount + 1;
    const target = new Vector3();
    const mid = new Vector3();
    const dir = new Vector3();
    const chest = new Vector3();
    const machine = latPulldownMachine({
      seatY: SEAT_Y,
      thighPadY: THIGH_PAD_Y,
      pulleyZ: PULLEY_Z,
    });
    const pulley = machine.pulley;
    const shapes = compileParts(machine.parts);
    const part = (id: string) => {
      const found = shapes.find((entry) => entry.part.id === id);
      if (!found) throw new Error(`lat pulldown is missing ${id}`);
      return found;
    };

    const torsoUp = new Vector3();
    const goals: Goal[] = [
      pin(body, "pelvisBottom", () => target.set(0, SEAT_Y - SINK, SEAT_Z), 55),
      ({ q, push }) => push(40 * (q[3] - rad(LEAN))),
      ({ frame, push }) => {
        torsoUp.set(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
        push(40 * (Math.atan2(-torsoUp.z, torsoUp.y) - rad(-LEAN)));
      },
      mirrored(body, 6),
    ];
    for (const side of SIDES) {
      const s = sideSign(side);
      goals.push(...plantFoot(body, side, new Vector3(s * HEEL_X, 0, HEEL_Z), TOE_OUT));
      goals.push(pin(body, `grip_${side}`, (q) => target.set(s * GRIP_X, q[barY], q[barZ]), 48));
      goals.push(aim(body, `wrist_${side}`, new Vector3(-s, 0, 0), new Vector3(0, 0, 1), 5));
      goals.push(aim(body, `wrist_${side}`, new Vector3(0, 0, 1), new Vector3(-s, 0, 0), 4));
    }
    goals.push(({ frame, push }) => {
      for (const side of SIDES) {
        const hip = frame.pos[body.index[`hip_${side}`]];
        const knee = frame.pos[body.index[`knee_${side}`]];
        push(16 * Math.min(0, knee.z - (hip.z + 0.18)));
      }
    });

    const overhead: Goal = ({ frame, q, push }) => {
      const left = frame.pos[body.index.shoulder_L];
      const right = frame.pos[body.index.shoulder_R];
      mid.set((left.x + right.x) / 2, (left.y + right.y) / 2, (left.z + right.z) / 2);
      dir.set(pulley[0] - mid.x, pulley[1] - mid.y, pulley[2] - mid.z);
      const length = Math.max(dir.length(), 1e-4);
      dir.multiplyScalar(REACH / length);
      push(34 * (q[barY] - (mid.y + dir.y)));
      push(34 * (q[barZ] - (mid.z + dir.z)));
    };
    const onChest: Goal = ({ frame, q, push }) => {
      worldPoint(frame, body.index.thoracic, chest.set(0, 0.2, 0.16), chest);
      push(42 * (q[barY] - chest.y));
      push(36 * (q[barZ] - (chest.z + BAR_R)));
    };
    const elbowsDown: Goal = ({ frame, push }) => {
      for (const side of SIDES) {
        const s = sideSign(side);
        const shoulder = frame.pos[body.index[`shoulder_${side}`]];
        const elbow = frame.pos[body.index[`elbow_${side}`]];
        push(14 * (elbow.y - (shoulder.y - 0.17)));
        push(12 * (elbow.z - (shoulder.z + 0.03)));
        push(10 * (elbow.x - shoulder.x - s * 0.11));
      }
    };

    const trunk = {
      "root.pitch": LEAN,
      "lumbar.flex": 2,
      "thoracic.flex": -3,
      "neck.flex": -8,
      "hip.flex": 80,
      "hip.abd": 10,
      "hip.rot": 4,
      "knee.flex": 92,
      "ankle.dorsi": 4,
      "ankle.inv": 2,
    };
    const armsUp = {
      "clavicle.prot": -2,
      "clavicle.elev": 12,
      "shoulder.elev": 162,
      "shoulder.plane": 58,
      "shoulder.twist": 14,
      "elbow.flex": 5,
      "forearm.pron": 72,
      "wrist.flex": -4,
      "wrist.dev": 0,
    };
    const armsDown = {
      "clavicle.prot": -14,
      "clavicle.elev": -8,
      "shoulder.elev": 52,
      "shoulder.plane": 35,
      "shoulder.twist": 24,
      "elbow.flex": 96,
      "forearm.pron": 68,
      "wrist.flex": -8,
      "wrist.dev": 2,
    };

    return {
      hints: {
        start: { "root.y": 0.5, "root.z": SEAT_Z, ...trunk, ...armsUp },
        end: { "root.y": 0.5, "root.z": SEAT_Z, ...trunk, ...armsDown },
      },
      extras: 2,
      extraStart: [1.66, 0.08],
      goals,
      keyGoals: {
        start: [
          overhead,
          lockAngle(body, "elbow_L.flex", 5, 16),
          lockAngle(body, "elbow_R.flex", 5, 16),
          lockAngle(body, "clavicle_L.elev", 10, 12),
          lockAngle(body, "clavicle_R.elev", 10, 12),
        ],
        end: [
          onChest,
          elbowsDown,
          lockAngle(body, "clavicle_L.elev", -8, 14),
          lockAngle(body, "clavicle_R.elev", -8, 14),
        ],
      },
      stiffness: {
        default: 0.45,
        root: 6,
        lumbar: 7,
        thoracic: 6,
        neck: 3,
        clavicle: 4,
        hip: 0.8,
        knee: 0.7,
        ankle: 0.4,
        shoulder: 0.35,
        elbow: 1.4,
        forearm: 0.45,
        wrist: 2.4,
      },
      obstacles: [
        { shape: part("lat.seatPad"), allow: seatAllow },
        { shape: part("lat.thighPad"), allow: thighAllow },
        { shape: part("lat.seatPost"), allow: {} },
        { shape: part("lat.base"), allow: {} },
        { shape: part("lat.post"), allow: {} },
      ],
      path: (s, startExtras, endExtras) => [
        startExtras[0] + (endExtras[0] - startExtras[0]) * s,
        startExtras[1] + (endExtras[1] - startExtras[1]) * s + 0.1 * Math.sin(Math.PI * s) ** 2,
      ],
      progress: (frame) => anchorPoint(body, frame, "grip_L").y,
      ground: "pelvisBottom",
      props: [cableAttachmentProp("bar", "lat-bar", 0.92)],
      propState: (_, extras) => [{ pos: [0, extras[0], extras[1]], quat: [0, 0, 0, 1] }],
      tethers: [{ id: "lat-cable", kind: "cable", radius: 0.005 }],
      tetherState: (_frame, _extras, propStates) => [
        { points: [[...pulley], [...propStates[0].pos]] },
      ],
      equipment: () => machine.parts,
      loads: SIDES.map((side) => ({
        anchor: `grip_${side}`,
        share: 0.5,
        grip: "hang" as const,
        pulley,
      })),
      support: { kind: "seated", passive: ["hip", "knee", "ankle"], brace: true },
      grip: "hang",
      phaseLabels: ["Pull", "Hold", "Return", "Stretch"],
      tempo: { lower: 1.8, bottom: 0.35, raise: 2.0, top: 0.55 },
      contacts: {
        "lat.seatPad": seatAllow,
        "lat.thighPad": thighAllow,
        bar: {
          hand_L: 0.06,
          hand_R: 0.06,
          chest: 0.03,
          girdle: 0.02,
          forearm_L: 0.025,
          forearm_R: 0.025,
          upperarm_L: 0.02,
          upperarm_R: 0.02,
        },
      },
      required: [
        { label: "Seated on the pad", anchor: "pelvisBottom", surfaceY: SEAT_Y - SINK },
        { label: "Left heel on the floor", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel on the floor", anchor: "heel_R", surfaceY: 0 },
        { label: "Left forefoot on the floor", anchor: "ballIn_L", surfaceY: 0 },
        { label: "Right forefoot on the floor", anchor: "ballIn_R", surfaceY: 0 },
        { label: "Left hand on the bar", anchor: "grip_L", prop: "bar" },
        { label: "Right hand on the bar", anchor: "grip_R", prop: "bar" },
      ],
      checks: [
        {
          id: "seated",
          label: "Sitting on the seat pad",
          cue: "Sit down on the machine's seat with the lower portion of your thighs snugly pressed against the machine's thigh pad.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const seat = anchorPoint(body, frame, "pelvisBottom");
                return (
                  Math.max(
                    Math.abs(seat.y - (SEAT_Y - SINK)),
                    Math.abs(seat.x),
                    Math.abs(seat.z - SEAT_Z),
                  ) * 100
                );
              },
              1.2,
              " cm off the seat",
            ),
        },
        {
          id: "thighs-under-pad",
          label: "Lower thighs snug under the thigh pad",
          cue: "Adjust the thigh pad to a height that lets you position your thighs snugly against it while sitting with your feet flat on the floor.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                let worst = 0;
                for (const side of SIDES) {
                  const hip = frame.pos[body.index[`hip_${side}`]];
                  const knee = frame.pos[body.index[`knee_${side}`]];
                  const span = knee.z - hip.z;
                  const t = span === 0 ? 0 : (THIGH_PAD_Z - hip.z) / span;
                  const centerY = hip.y + (knee.y - hip.y) * t;
                  const radius = 0.085 + (0.058 - 0.085) * Math.min(1, Math.max(0, t));
                  const gap = THIGH_PAD_Y - THIGH_PAD_R - (centerY + radius);
                  worst = Math.max(worst, Math.abs(gap) * 100, t < 0.15 || t > 0.95 ? 20 : 0);
                }
                return worst;
              },
              2.5,
              " cm between the thigh and the pad",
            ),
        },
        {
          id: "feet-flat",
          label: "Feet flat on the floor",
          cue: "Position your thighs snugly against the thigh pad while sitting with your feet flat on the floor.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const lifts = [
                  "heel_L",
                  "heel_R",
                  "ballIn_L",
                  "ballIn_R",
                  "ballOut_L",
                  "ballOut_R",
                ].map((name) => Math.abs(anchorPoint(body, frame, name).y) * 1000);
                return Math.max(...lifts);
              },
              8,
              " mm off the floor",
            ),
        },
        {
          id: "backward-lean",
          label: "Slight backward lean held through the set",
          cue: "In the seated position, slightly lean your torso backward at your hips. Maintain this slight backward lean throughout your set, rather than leaning further backward.",
          evaluate: (context) => {
            const leanOf = (frame: Frame) => {
              const up = new Vector3(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
              return deg(Math.atan2(-up.z, up.y));
            };
            const start = leanOf(context.frames[context.top]);
            let drift = 0;
            let lean = start;
            for (const frame of context.frames) {
              const value = leanOf(frame);
              lean = value;
              drift = Math.max(drift, Math.abs(value - start));
            }
            return {
              pass: within(start, 8, 22) && drift < 5,
              measured: `${start.toFixed(1)}° back at start, ${drift.toFixed(1)}° drift (finishes ${lean.toFixed(1)}°)`,
            };
          },
        },
        {
          id: "overhand-grip",
          label: "Slightly outside shoulder width, palms forward",
          cue: "Firmly grasp the bar with a slightly outside shoulder-width overhand grip, such that your palms face forward.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const hands =
                  anchorPoint(body, frame, "grip_L").x - anchorPoint(body, frame, "grip_R").x;
                const shoulders =
                  frame.pos[body.index.shoulder_L].x - frame.pos[body.index.shoulder_R].x;
                const palm = new Vector3(-1, 0, 0).applyQuaternion(frame.rot[body.index.wrist_L]);
                const widthMiss = hands / shoulders < 1.15 || hands / shoulders > 1.85 ? 30 : 0;
                const palmMiss = palm.z < 0.7 ? (0.7 - palm.z) * 100 : 0;
                return widthMiss + palmMiss;
              },
              8,
              " grip-score",
            ),
        },
        {
          id: "overhead-start",
          label: "Elbows straight overhead, in line with the cable",
          cue: "From this position, your elbows should be straight, with your arms overhead and slightly forward (rather than completely vertical), in line with the machine's resistance.",
          evaluate: ({ sequence, frames, angles, top }) => {
            const frame = frames[top];
            const elbow = deg(angles[top]["elbow_L.flex"]);
            const elev = deg(angles[top]["shoulder_L.elev"]);
            const left = frame.pos[body.index.shoulder_L];
            const right = frame.pos[body.index.shoulder_R];
            const bar = sequence.propStates[top][0].pos;
            const arm = new Vector3(
              bar[0] - (left.x + right.x) / 2,
              bar[1] - (left.y + right.y) / 2,
              bar[2] - (left.z + right.z) / 2,
            );
            const cable = new Vector3(pulley[0] - bar[0], pulley[1] - bar[1], pulley[2] - bar[2]);
            const off = deg(arm.angleTo(cable));
            return {
              pass: elbow < 14 && elev > 140 && off < 20,
              measured: `elbows ${elbow.toFixed(0)}° bent, arms ${elev.toFixed(0)}° up, ${off.toFixed(1)}° off the cable`,
            };
          },
        },
        {
          id: "bar-to-chest",
          label: "Bar reaches the upper chest",
          cue: "When pulling through your full range of motion, you should finish with the bar touching your upper chest or very close to doing so.",
          evaluate: ({ sequence, frames, bottom }) => {
            const bar = sequence.propStates[bottom][0].pos;
            const spot = worldPoint(frames[bottom], body.index.thoracic, new Vector3(0, 0.2, 0.16));
            const gap = Math.hypot(bar[1] - spot.y, bar[2] - (spot.z + BAR_R));
            return {
              pass: gap < 0.03,
              measured: `bar ${(gap * 100).toFixed(1)} cm from the upper chest`,
            };
          },
        },
        {
          id: "elbows-down",
          label: "Elbows drive down toward the sides",
          cue: "Pull the bar down toward your upper chest by driving your elbows down toward your sides as you progressively bend them.",
          evaluate: ({ frames, angles, bottom }) => {
            const frame = frames[bottom];
            const shoulder = frame.pos[body.index.shoulder_L];
            const elbow = frame.pos[body.index.elbow_L];
            const drop = shoulder.y - elbow.y;
            const arm = elbow.clone().sub(shoulder);
            const out = deg(Math.atan2(Math.abs(arm.x), Math.hypot(arm.y, arm.z)));
            const bend = deg(angles[bottom]["elbow_L.flex"]);
            return {
              pass: drop > 0.1 && within(out, 8, 55) && bend > 70,
              measured: `elbows ${(drop * 100).toFixed(0)} cm below shoulders, ${out.toFixed(0)}° out, ${bend.toFixed(0)}° bent`,
            };
          },
        },
        {
          id: "scapular-depression",
          label: "Shoulder blades pull down as the bar comes in",
          cue: "Simultaneously pull your shoulder blades down away from your ears.",
          evaluate: ({ angles, top, bottom }) => {
            const start = deg(angles[top]["clavicle_L.elev"]);
            const peak = deg(angles[bottom]["clavicle_L.elev"]);
            return {
              pass: peak < -4 && start - peak > 8,
              measured: `${start.toFixed(1)}° overhead -> ${peak.toFixed(1)}° at chest`,
            };
          },
        },
        {
          id: "cable-taut",
          label: "Cable stays taut from the pulley to the bar",
          cue: "You should feel tension from the cable station holding your arms in this position, and raise the bar in line with the machine's resistance.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_frame, _angles, index) => {
                const bar = context.sequence.propStates[index][0].pos;
                const drop = pulley[1] - bar[1];
                const drift = Math.hypot(
                  bar[0] - pulley[0],
                  Math.max(0, bar[2] - pulley[2] - 0.08),
                );
                const slack = drop < 0.2 ? (0.2 - drop) * 100 : 0;
                return slack + drift * 100;
              },
              8,
              " cm off taut overhead cable",
            ),
        },
      ],
    };
  },
};
