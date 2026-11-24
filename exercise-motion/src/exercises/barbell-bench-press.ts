import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body } from "../body";
import { everyFrame, within } from "../checks";
import { BAR_RADIUS, benchRack, compileParts, flatBench, type PropDef } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg } from "../math";
import { aim, type Goal, mirrored, type Obstacle, pin, plantFoot } from "../solver";

const BENCH_TOP = 0.44;
/** How far skin and pad give where the body rests on the bench. */
const SINK = 0.008;
/** 1.5 times shoulder width between the index fingers puts the middle of each hand here. */
const GRIP_X = 0.34;
const FOOT_X = 0.22;
const HEEL_Z = 0.4;
const BAR: PropDef = { id: "bar", kind: "barbell", barKg: 20, collarX: 0.655, length: 2.2 };

export const barbellBenchPress: ExerciseSpec = {
  id: "barbell-bench-press",
  catalogId: "19f5c6f170d8808bb424e98de4472a7e",
  name: "Barbell Bench Press",
  defaultLoadKg: 70,
  loadUnit: "total",
  build(body: Body) {
    const barY = body.dofCount;
    const barZ = body.dofCount + 1;
    const target = new Vector3();
    const bench = flatBench({ topY: BENCH_TOP, zHead: -0.92, zFoot: 0.13 });
    const pad = compileParts(bench).find((shape) => shape.part.id === "bench.pad")!;
    const resting = {
      pelvis: 0.025,
      abdomen: 0.02,
      chest: 0.03,
      girdle: 0.03,
      neck: 0.012,
      head: 0.02,
      thigh_L: 0.02,
      thigh_R: 0.02,
      thighShaft_L: 0.02,
      thighShaft_R: 0.02,
      upperarm_L: 0.015,
      upperarm_R: 0.015,
    };
    const obstacles: Obstacle[] = [{ shape: pad, allow: resting }];

    const goals: Goal[] = [
      pin(body, "sacrum", () => target.set(0, BENCH_TOP - SINK, 0), 40),
      pin(body, "upperBack", () => target.set(0, BENCH_TOP - SINK, 0), 40, "xy"),
      pin(body, "occiput", () => target.set(0, BENCH_TOP - SINK, 0), 20, "xy"),
    ];
    for (const side of SIDES) {
      const s = sideSign(side);
      goals.push(...plantFoot(body, side, new Vector3(s * FOOT_X, 0, HEEL_Z), 0.26));
      goals.push(pin(body, `press_${side}`, (q) => target.set(s * GRIP_X, q[barY], q[barZ]), 40));
      goals.push(aim(body, `wrist_${side}`, new Vector3(0, 0, 1), new Vector3(-s, 0, 0), 3));
      // Seen from the side, the forearm stays vertical: the elbow under the wrist along the bench.
      const elbow = body.index[`elbow_${side}`];
      const wrist = body.index[`wrist_${side}`];
      goals.push(({ frame, push }) => push(22 * (frame.pos[elbow].z - frame.pos[wrist].z)));
    }
    const shoulderL = body.index.shoulder_L;
    const shoulderR = body.index.shoulder_R;
    const overShoulders: Goal = ({ frame, q, push }) =>
      push(25 * (q[barZ] - (frame.pos[shoulderL].z + frame.pos[shoulderR].z) / 2));
    const point = new Vector3();
    const onChest: Goal = ({ frame, q, push }) => {
      anchorPoint(body, frame, "sternum", point);
      push(40 * (q[barY] - (point.y + BAR_RADIUS - 0.002)));
      push(25 * (q[barZ] - point.z));
    };
    // Buttocks and shoulder blades stay on the pad while the lower back arches off it, so the pelvis tips forward by
    // as much as the spine extends and the neck flexes the same amount back to rest the head.
    const trunk = {
      "root.y": BENCH_TOP + 0.105,
      "root.pitch": -80,
      "lumbar.flex": -10,
      "thoracic.flex": -6,
      "neck.flex": 8,
      "clavicle.prot": -18,
      "clavicle.elev": -4,
    };
    const legs = { "hip.flex": -4, "hip.abd": 16, "hip.rot": 6, "knee.flex": 88, "ankle.dorsi": 2 };

    return {
      hints: {
        // At lockout a straight arm could be turned any way about its own length. It is turned the way it will bend:
        // elbows pointing out, as they have to once the forearms stay vertical on the way down.
        start: {
          ...trunk,
          ...legs,
          "shoulder.elev": 88,
          "shoulder.plane": 78,
          "shoulder.twist": 40,
          "elbow.flex": 6,
          "forearm.pron": 24,
          "wrist.flex": -8,
        },
        end: {
          ...trunk,
          ...legs,
          "shoulder.elev": 62,
          "shoulder.plane": -15,
          "shoulder.twist": 10,
          "elbow.flex": 115,
          "forearm.pron": 40,
          "wrist.flex": -12,
        },
      },
      extras: 2,
      extraStart: [1.2, -0.5],
      goals: [...goals, mirrored(body, 4)],
      keyGoals: { start: [overShoulders], end: [onChest] },
      stiffness: {
        default: 0.5,
        root: 5,
        lumbar: 6,
        thoracic: 6,
        neck: 3,
        clavicle: 4,
        hip: 1,
        knee: 1,
        ankle: 0.5,
        shoulder: 0.4,
        elbow: 2,
        forearm: 0.6,
        wrist: 2.5,
      },
      obstacles,
      progress: (frame) => anchorPoint(body, frame, "press_L").y,
      ground: "sacrum",
      props: [BAR],
      propState: (_, extras) => [{ pos: [0, extras[0], extras[1]], quat: [0, 0, 0, 1] }],
      equipment: ({ start, end, startFrame }) => [
        ...bench,
        ...benchRack({
          z: anchorPoint(body, startFrame, "mouth").z,
          hookY: start[barY] - 0.05 - BAR_RADIUS,
          safetyY: end[barY] - BAR_RADIUS - 0.025,
          safetyReach: 0.6,
        }),
      ],
      loads: SIDES.map((side) => ({ anchor: `press_${side}`, share: 0.5, grip: "press" as const })),
      // The bench carries the trunk and pins the shoulder blades, and the feet only brace.
      support: {
        kind: "lying",
        passive: ["lumbar", "thoracic", "neck", "hip", "knee", "ankle", "clavicle"],
      },
      tempo: { lower: 2, bottom: 0.2, raise: 1.3, top: 0.7 },
      contacts: {
        "bench.pad": resting,
        bar: { hand_L: 0.06, hand_R: 0.06, chest: 0.012 },
      },
      required: [
        { label: "Buttocks on the bench", anchor: "sacrum", surfaceY: BENCH_TOP - SINK },
        { label: "Upper back on the bench", anchor: "upperBack", surfaceY: BENCH_TOP - SINK },
        { label: "Head on the bench", anchor: "occiput", surfaceY: BENCH_TOP - SINK },
        { label: "Left foot on the floor", anchor: "heel_L", surfaceY: 0 },
        { label: "Right foot on the floor", anchor: "heel_R", surfaceY: 0 },
        { label: "Left hand on the bar", anchor: "press_L", prop: "bar" },
        { label: "Right hand on the bar", anchor: "press_R", prop: "bar" },
      ],
      checks: [
        {
          id: "mouth-under-bar",
          label: "Mouth under the racked bar",
          cue: "Position yourself so that your mouth is close to being directly underneath the barbell.",
          evaluate: ({ sequence, frames, top }) => {
            const hook = sequence.equipment.find((part) => part.id === "rack.hook_L")!;
            const off = Math.abs(hook.pos[2] - anchorPoint(body, frames[top], "mouth").z);
            return {
              pass: off < 0.04,
              measured: `J-hooks ${(off * 100).toFixed(1)} cm from the mouth along the bench`,
            };
          },
        },
        {
          id: "hook-height",
          label: "J-hooks one slight elbow bend below lockout",
          cue: "After fully straightening your elbows to lift the bar off the J-hooks, the bar should ideally be close to 2in (5cm) above the top of the J-hooks.",
          evaluate: ({ sequence, top }) => {
            const hook = sequence.equipment.find((part) => part.id === "rack.hook_L")!;
            const lift =
              sequence.propStates[top][0].pos[1] - BAR_RADIUS - (hook.pos[1] + hook.size[1] / 2);
            return {
              pass: within(lift, 0.03, 0.08),
              measured: `bar ${(lift * 100).toFixed(1)} cm above the hooks at lockout`,
            };
          },
        },
        {
          id: "safeties",
          label: "Safety arms just under the lowest bar position",
          cue: "Position the safety pins/spotter arms to be slightly under the lowest point at which the bar descends.",
          evaluate: ({ sequence, bottom }) => {
            const safety = sequence.equipment.find((part) => part.id === "rack.safety_L")!;
            const gap =
              sequence.propStates[bottom][0].pos[1] -
              BAR_RADIUS -
              (safety.pos[1] + safety.size[1] / 2);
            return {
              pass: within(gap, 0.005, 0.06),
              measured: `${(gap * 100).toFixed(1)} cm of clearance`,
            };
          },
        },
        {
          id: "feet",
          label: "Feet flat, about shoulder width, shins near vertical",
          cue: "Your knees are bent with your feet on the floor, approximately shoulder-width apart. You can position the soles of your feet flat on the ground with your shins close to being vertical.",
          evaluate: ({ frames, top }) => {
            const frame = frames[top];
            const feet =
              anchorPoint(body, frame, "heel_L").x - anchorPoint(body, frame, "heel_R").x;
            const shoulders =
              frame.pos[body.index.shoulder_L].x - frame.pos[body.index.shoulder_R].x;
            const shin = frame.pos[body.index.knee_L].clone().sub(frame.pos[body.index.ankle_L]);
            const lean = deg(Math.atan2(Math.hypot(shin.x, shin.z), shin.y));
            return {
              pass: within(feet / shoulders, 0.85, 1.4) && lean < 15,
              measured: `heels ${(feet * 100).toFixed(0)} cm apart (${((feet / shoulders) * 100).toFixed(0)}% of shoulder width), shins ${lean.toFixed(0)}° off vertical`,
            };
          },
        },
        {
          id: "grip-width",
          label: "Grip about 1.5 times shoulder width",
          cue: "A moderate grip width for the bench press is commonly considered to be around 1.5 times your shoulder width.",
          evaluate: ({ frames, top }) => {
            const frame = frames[top];
            const hands =
              anchorPoint(body, frame, "press_L").x - anchorPoint(body, frame, "press_R").x - 0.09;
            // Shoulder width is measured across the bony tips, which sit about 1.5 cm outside each joint centre.
            const shoulders = body.joints[body.index.shoulder_L].offset.x * 2 + 0.05 + 0.03;
            return {
              pass: within(hands / shoulders, 1.3, 1.7),
              measured: `${(hands / shoulders).toFixed(2)}x shoulder width between the index fingers`,
            };
          },
        },
        {
          id: "straight-wrists",
          label: "Wrists reasonably straight",
          cue: "Avoid grasping the bar with your wrists cocked back into an excessively extended position.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_, a) => deg(Math.max(-a["wrist_L.flex"], -a["wrist_R.flex"])),
              25,
              "° of wrist extension",
            ),
        },
        {
          id: "proud-chest",
          label: "Shoulder blades stay pulled back",
          cue: "Assume a “proud chest” posture by tightly pulling your shoulder blades back together. Maintain this chest position throughout your set.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_, a) => deg(Math.max(a["clavicle_L.prot"], a["clavicle_R.prot"])),
              -10,
              "° of protraction (negative is pulled back)",
            ),
        },
        {
          id: "bar-over-shoulders",
          label: "Lockout with the bar above the shoulders",
          cue: "You should finish with your elbows fully straightened and the bar situated above your shoulders.",
          evaluate: ({ sequence, frames, angles, top }) => {
            const off =
              sequence.propStates[top][0].pos[2] - frames[top].pos[body.index.shoulder_L].z;
            const elbow = deg(angles[top]["elbow_L.flex"]);
            return {
              pass: Math.abs(off) < 0.03 && elbow < 12,
              measured: `bar ${(Math.abs(off) * 100).toFixed(1)} cm from over the shoulder joints, elbows ${elbow.toFixed(0)}° bent`,
            };
          },
        },
        {
          id: "touch-lower-chest",
          label: "Bar taps the lower chest",
          cue: "Lower the bar toward your lower chest in a controlled manner until you can tap your lower chest lightly with the bar.",
          evaluate: ({ sequence, frames, bottom }) => {
            const bar = sequence.propStates[bottom][0].pos;
            const sternum = anchorPoint(body, frames[bottom], "sternum");
            const gap = bar[1] - BAR_RADIUS - sternum.y;
            return {
              pass: within(gap, -0.006, 0.01) && Math.abs(bar[2] - sternum.z) < 0.04,
              measured: `bar ${(Math.abs(gap) * 1000).toFixed(0)} mm ${gap >= 0 ? "above" : "into"} the lower sternum`,
            };
          },
        },
        {
          id: "forearms-vertical",
          label: "Elbows stacked under the wrists from the side",
          cue: "Strive to keep your elbows stacked underneath your wrists as your forearms remain close to vertical throughout the set when viewed from the side.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const forearm = frame.pos[body.index.wrist_L]
                  .clone()
                  .sub(frame.pos[body.index.elbow_L]);
                return Math.abs(deg(Math.atan2(forearm.z, forearm.y)));
              },
              10,
              "° off vertical",
            ),
        },
        {
          id: "elbow-tuck",
          label: "Upper arms 45 to 75° from the torso at the bottom",
          cue: "Near the bottom of the rep, the proper balance should result in your upper arms forming approximately 45-75-degree angles with your torso.",
          evaluate: ({ frames, bottom }) => {
            const frame = frames[bottom];
            const arm = frame.pos[body.index.elbow_L].clone().sub(frame.pos[body.index.shoulder_L]);
            // Seen from above: 0° is tucked along the body, 90° is straight out to the side.
            const angle = deg(Math.atan2(arm.x, arm.z));
            return {
              pass: within(angle, 45, 75),
              measured: `${angle.toFixed(0)}° seen from above`,
            };
          },
        },
        {
          id: "bar-path",
          label: "Bar tracks toward the abdomen as it lowers",
          cue: "When aiming to touch the bar to your lower chest, the bar will track slightly forward toward your abdomen rather than moving exclusively in a vertical line.",
          evaluate: ({ sequence, top, bottom }) => {
            const travel =
              sequence.propStates[bottom][0].pos[2] - sequence.propStates[top][0].pos[2];
            return {
              pass: travel > 0.03,
              measured: `${(travel * 100).toFixed(1)} cm toward the feet`,
            };
          },
        },
        {
          id: "five-points",
          label: "Buttocks, upper back and head stay planted",
          cue: "Your feet should be firmly dug into the ground, while your buttocks, upper back, and head are firmly planted on the bench. Maintain these five points of contact throughout your whole set.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) =>
                Math.max(
                  ...["sacrum", "upperBack", "occiput"].map((name) =>
                    Math.abs(anchorPoint(body, frame, name).y - (BENCH_TOP - SINK)),
                  ),
                ) * 1000,
              8,
              " mm off the pad",
            ),
        },
      ],
    };
  },
};
