import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body } from "../body";
import { BAR_RADIUS, smithMachine, type PropDef } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg, rad } from "../math";
import { aim, type Goal, kneeOffFootLine, kneeOverToes, mirrored, pin, plantFoot } from "../solver";
import { everyFrame, within } from "../checks";

const STANCE = 0.19;
const TOE_OUT = rad(20);
/** The heel's contact point sits 2.5 cm ahead of the back of the heel, which the instructions place just in front of the bar. */
const HEEL_Z = 0.03 + 0.025;
const GRIP_X = 0.38;
const BAR: PropDef = { id: "bar", kind: "barbell", barKg: 20, collarX: 0.72, length: 2.18 };

export const smithMachineBackSquat: ExerciseSpec = {
  id: "smith-machine-back-squat",
  catalogId: "1a25c6f170d8800a86efdcb6f902b9a9",
  name: "Smith Machine Back Squat",
  defaultLoadKg: 80,
  loadUnit: "total",
  build(body: Body) {
    const barHeight = body.dofCount;
    const target = new Vector3();
    const goals: Goal[] = [pin(body, "traps", (q) => target.set(0, q[barHeight], 0), 40)];
    for (const side of SIDES) {
      const s = sideSign(side);
      const heel = new Vector3(s * STANCE, 0, HEEL_Z);
      goals.push(...plantFoot(body, side, heel, TOE_OUT));
      goals.push(pin(body, `press_${side}`, (q) => target.set(s * GRIP_X, q[barHeight], 0), 30));
      goals.push(aim(body, `wrist_${side}`, new Vector3(0, 0, 1), new Vector3(-s, 0, 0), 3));
      goals.push(kneeOverToes(body, side, 12));
    }
    const hipL = body.index.hip_L;
    const kneeL = body.index.knee_L;
    const hipR = body.index.hip_R;
    const kneeR = body.index.knee_R;
    const depth: Goal = ({ frame, push }) => {
      push(30 * (frame.pos[hipL].y - frame.pos[kneeL].y));
      push(30 * (frame.pos[hipR].y - frame.pos[kneeR].y));
    };
    const arms = {
      "clavicle.prot": -14,
      "shoulder.elev": 36,
      "shoulder.plane": -35,
      "shoulder.twist": -70,
      "elbow.flex": 138,
      "forearm.pron": 60,
      "wrist.flex": -25,
    };

    return {
      hints: {
        start: {
          "root.z": 0.09,
          "hip.flex": 3,
          "hip.abd": 7,
          "hip.rot": 14,
          "knee.flex": 3,
          "ankle.dorsi": 1,
          "ankle.inv": 6,
          ...arms,
        },
        end: {
          "root.z": -0.11,
          "root.y": 0.47,
          "root.pitch": 22,
          "hip.flex": 112,
          "hip.abd": 20,
          "hip.rot": 8,
          "knee.flex": 116,
          "ankle.dorsi": 24,
          "ankle.inv": 2,
          "lumbar.flex": 2,
          ...arms,
        },
      },
      extras: 1,
      extraStart: [1.45],
      goals: [...goals, mirrored(body, 4)],
      keyGoals: { start: [], end: [depth] },
      stiffness: {
        default: 0.5,
        lumbar: 4,
        thoracic: 4,
        neck: 3,
        knee: 0.6,
        ankle: 0.4,
        "ankle.inv": 1,
        hip: 0.3,
        shoulder: 0.25,
        elbow: 0.2,
        wrist: 0.4,
        forearm: 0.2,
        clavicle: 1,
      },
      obstacles: [],
      progress: (frame) => anchorPoint(body, frame, "traps").y,
      ground: "heel_L",
      props: [BAR],
      propState: (_, extras) => [{ pos: [0, extras[0], 0], quat: [0, 0, 0, 1] }],
      equipment: ({ end }) => smithMachine({ stopY: end[barHeight] - 0.05 }),
      loads: [{ anchor: "traps", share: 1, grip: "rest" }],
      // The hands only steady the bar, which carries the arms' weight.
      support: { kind: "standing", rail: true, passive: ["shoulder", "elbow", "forearm", "wrist"] },
      tempo: { lower: 2, bottom: 0.3, raise: 1.5, top: 0.8 },
      contacts: {
        // The bar beds into the traps and the rear delts.
        bar: {
          hand_L: 0.06,
          hand_R: 0.06,
          girdle: 0.03,
          neck: 0.012,
          upperarm_L: 0.035,
          upperarm_R: 0.035,
        },
      },
      required: [
        { label: "Bar on the upper back", anchor: "traps", prop: "bar" },
        { label: "Left hand on the bar", anchor: "press_L", prop: "bar" },
        { label: "Right hand on the bar", anchor: "press_R", prop: "bar" },
        { label: "Left heel on the floor", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel on the floor", anchor: "heel_R", surfaceY: 0 },
        { label: "Left forefoot on the floor", anchor: "ballIn_L", surfaceY: 0 },
        { label: "Right forefoot on the floor", anchor: "ballIn_R", surfaceY: 0 },
      ],
      checks: [
        {
          id: "heels-ahead-of-bar",
          label: "Heels slightly in front of the bar",
          cue: "Position the back of your heels slightly in front of the bar with your feet near shoulder width apart as your toes are pointing somewhat out to the sides.",
          evaluate: ({ frames, top }) => {
            const gap = anchorPoint(body, frames[top], "heel_L").z - 0.025;
            return {
              pass: gap > 0 && gap < 0.15,
              measured: `${(gap * 100).toFixed(1)} cm ahead of the bar`,
            };
          },
        },
        {
          id: "stance",
          label: "Shoulder-width stance, toes out",
          cue: "Feet near shoulder width apart as your toes are pointing somewhat out to the sides.",
          evaluate: ({ frames, top }) => {
            const frame = frames[top];
            const width =
              anchorPoint(body, frame, "heel_L").x - anchorPoint(body, frame, "heel_R").x;
            const shoulders =
              frame.pos[body.index.shoulder_L].x - frame.pos[body.index.shoulder_R].x;
            const toe = anchorPoint(body, frame, "toe_L").sub(anchorPoint(body, frame, "heel_L"));
            const out = deg(Math.atan2(toe.x, toe.z));
            return {
              pass: within(width / shoulders, 0.8, 1.25) && within(out, 5, 45),
              measured: `heels ${(width * 100).toFixed(0)} cm apart (${((width / shoulders) * 100).toFixed(0)}% of shoulder width), toes ${out.toFixed(0)}° out`,
            };
          },
        },
        {
          id: "grip",
          label: "Grip somewhat outside shoulder width",
          cue: "Grasp each side of the bar with a somewhat outside shoulder-width grip that feels comfortable to you.",
          evaluate: ({ frames, top }) => {
            const frame = frames[top];
            const upperArm = body.colliders[body.colliderIndex.upperarm_L];
            const outside =
              anchorPoint(body, frame, "press_L").x -
              (frame.pos[body.index.shoulder_L].x + upperArm.ra);
            return {
              pass: within(outside, 0.02, 0.2),
              measured: `each hand ${(outside * 100).toFixed(0)} cm outside its shoulder`,
            };
          },
        },
        {
          id: "neck-neutral",
          label: "Neck stays neutral",
          cue: "Your neck should be near a neutral position, like when you are normally standing upright. Keep your neck in this position throughout the exercise.",
          evaluate: (context) =>
            everyFrame(context, (_, a) => Math.abs(deg(a["neck.flex"])), 12, "° from neutral"),
        },
        {
          id: "flat-back",
          label: "Back stays flat",
          cue: "Avoid letting your lower back round or your chest cave down from upper back rounding.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_, a) =>
                deg(
                  Math.abs(a["lumbar.flex"] - context.angles[context.top]["lumbar.flex"]) +
                    Math.abs(a["thoracic.flex"] - context.angles[context.top]["thoracic.flex"]),
                ),
              8,
              "° of spinal flexion change",
            ),
        },
        {
          id: "torso-lean",
          label: "Torso leans forward only mildly",
          cue: "As you descend, it is natural for your torso to lean forward mildly at your hips.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const up = new Vector3(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
                return deg(Math.acos(Math.min(1, up.y)));
              },
              40,
              "° from vertical",
            ),
        },
        {
          id: "knees-over-toes",
          label: "Knees track the second and third toes",
          cue: "Strive to keep each knee aligned with the second toe or the third toe of that side’s foot as you avoid letting your knees cave inward relative to your feet.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) =>
                Math.max(...SIDES.map((side) => Math.abs(kneeOffFootLine(body, frame, side)))) *
                100,
              3.5,
              " cm off the foot line",
            ),
        },
        {
          id: "depth",
          label: "Thighs reach about parallel",
          cue: "People can often descend at least until their thighs are fairly close to being parallel to the ground.",
          evaluate: ({ frames, bottom }) => {
            const frame = frames[bottom];
            const thigh = frame.pos[body.index.knee_L].clone().sub(frame.pos[body.index.hip_L]);
            const above = deg(Math.asin(-thigh.y / thigh.length()));
            return {
              pass: above < 10,
              measured: `thigh ${Math.abs(above).toFixed(1)}° ${above >= 0 ? "above" : "below"} parallel at the bottom`,
            };
          },
        },
        {
          id: "lockout",
          label: "Fully upright at the top",
          cue: "Standing up as you drive through the ground while extending your knees and hips until you have returned to a fully upright position.",
          evaluate: ({ angles, top }) => {
            const knee = deg(angles[top]["knee_L.flex"]);
            const hip = deg(angles[top]["hip_L.flex"]);
            return {
              pass: knee < 10 && hip < 12,
              measured: `knee ${knee.toFixed(0)}°, hip ${hip.toFixed(0)}° of flexion`,
            };
          },
        },
        {
          id: "safety-stops",
          label: "Safety stops just below the lowest bar position",
          cue: "Position the safety stops so that they are slightly below the lowest height at which the bar descends at the bottom of your squat.",
          evaluate: ({ sequence, bottom }) => {
            const stop = sequence.equipment.find((part) => part.id === "smith.stop_L")!;
            const gap =
              sequence.propStates[bottom][0].pos[1] - BAR_RADIUS - (stop.pos[1] + stop.size[1] / 2);
            return {
              pass: within(gap, 0.01, 0.1),
              measured: `${(gap * 100).toFixed(1)} cm of clearance`,
            };
          },
        },
        {
          id: "bar-on-rails",
          label: "Bar travels straight down the rails",
          cue: "If your Smith machine has purely vertical sliding rails, you can perform the same movement regardless of which direction you face.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_, __, i) =>
                Math.hypot(
                  context.sequence.propStates[i][0].pos[0],
                  context.sequence.propStates[i][0].pos[2],
                ) * 1000,
              1,
              " mm off the rail line",
            ),
        },
      ],
    };
  },
};
