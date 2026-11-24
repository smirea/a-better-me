import { Quaternion, Vector3 } from "three";
import {
  anchorPoint,
  SIDES,
  sideSign,
  worldPoint,
  type Body,
  type Frame,
  type Side,
} from "../body";
import { everyFrame, within } from "../checks";
import { dumbbellHead, type PropDef } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg, rad } from "../math";
import { stretchOf } from "../muscles";
import { balance, type Goal, mirrored, plantFoot } from "../solver";

const STANCE = 0.1;
const TOE_OUT = rad(6);
const LOAD_KG = 30;
/** Palms face halfway between backward and inward, which the instructions call a semi-overhand grip. */
const PRONATION = 45;
const CLEARANCE = 0.015;
const AZIMUTH = rad(35);
/** How much of their end range the hamstrings reach at the bottom, where the instructions stop the descent. */
const END_STRETCH = 0.85;

/**
 * Where a hand holding a dumbbell rides beside the leg at a given height: against the outer front of the thigh or
 * shin, a head's radius and a little clearance off the skin. The spot is 35° forward of straight out to the side,
 * which lets the arms hang close to plumb at the top.
 */
function besideLeg(body: Body, frame: Frame, side: Side, y: number, out: Vector3) {
  const hip = frame.pos[body.index[`hip_${side}`]];
  const knee = frame.pos[body.index[`knee_${side}`]];
  const ankle = frame.pos[body.index[`ankle_${side}`]];
  const thigh = body.colliders[body.colliderIndex[`thigh_${side}`]];
  const shank = body.colliders[body.colliderIndex[`shank_${side}`]];
  const [top, bottom, part] = y >= knee.y ? [hip, knee, thigh] : [knee, ankle, shank];
  const t = Math.min(1, Math.max(0, (top.y - y) / Math.max(top.y - bottom.y, 1e-6)));
  const reach = part.ra + (part.rb - part.ra) * t + dumbbellHead(LOAD_KG).radius + CLEARANCE;
  const s = sideSign(side);
  return out.set(
    top.x + (bottom.x - top.x) * t + s * reach * Math.cos(AZIMUTH),
    y,
    top.z + (bottom.z - top.z) * t + reach * Math.sin(AZIMUTH),
  );
}

const DUMBBELLS: PropDef[] = [
  { id: "dumbbell_L", kind: "dumbbell" },
  { id: "dumbbell_R", kind: "dumbbell" },
];
/** The handle runs along the hand's thumb-to-little-finger axis, which is local Z. */
const HANDLE = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), new Vector3(0, 0, 1));

export const dumbbellRomanianDeadlift: ExerciseSpec = {
  id: "dumbbell-romanian-deadlift",
  catalogId: "1a35c6f170d880489b7be1d31faff56b",
  name: "Dumbbell Romanian Deadlift",
  defaultLoadKg: LOAD_KG,
  loadUnit: "perSide",
  build(body: Body) {
    const handHeight = body.dofCount;
    const target = new Vector3();
    const point = new Vector3();
    const midfoot = 0.05 + 0.04;
    const goals: Goal[] = [
      balance(
        body,
        SIDES.map((side) => ({ anchor: `grip_${side}`, kg: LOAD_KG })),
        midfoot,
        14,
      ),
    ];
    for (const side of SIDES) {
      const s = sideSign(side);
      goals.push(...plantFoot(body, side, new Vector3(s * STANCE, 0, 0), TOE_OUT));
      const grip = body.anchors[`grip_${side}`];
      goals.push(({ frame, q, push }) => {
        besideLeg(body, frame, side, q[handHeight], target);
        worldPoint(frame, grip.joint, grip.local, point);
        push(30 * (point.x - target.x));
        push(40 * (point.y - target.y));
        push(30 * (point.z - target.z));
      });
      // Shins stay vertical: the knee holds its place over the ankle while the hips travel back.
      const knee = body.index[`knee_${side}`];
      const ankle = body.index[`ankle_${side}`];
      goals.push(({ frame, push }) => push(6 * (frame.pos[knee].z - frame.pos[ankle].z)));
    }
    const hamstrings: Goal = ({ angles, push }) => {
      for (const side of SIDES) push(6 * (stretchOf("hamstrings", angles, side) - END_STRETCH));
    };
    const arms = {
      "shoulder.elev": 9,
      "shoulder.plane": 35,
      "elbow.flex": 4,
      "forearm.pron": PRONATION,
      "clavicle.prot": -4,
    };

    return {
      hints: {
        start: {
          "root.z": 0.06,
          "hip.flex": 2,
          "hip.abd": 1,
          "hip.rot": 5,
          "knee.flex": 4,
          "ankle.dorsi": 1,
          ...arms,
        },
        end: {
          "root.z": -0.14,
          "root.y": 0.9,
          "root.pitch": 62,
          "hip.flex": 80,
          "hip.abd": 1,
          "hip.rot": 5,
          "knee.flex": 18,
          "ankle.dorsi": -1,
          ...arms,
          "shoulder.elev": 62,
          "shoulder.plane": 80,
          "neck.flex": -8,
        },
      },
      extras: 1,
      extraStart: [0.8],
      goals: [...goals, mirrored(body, 4)],
      keyGoals: { start: [], end: [hamstrings] },
      stiffness: {
        default: 0.5,
        lumbar: 5,
        thoracic: 5,
        neck: 1.5,
        knee: 1.2,
        ankle: 0.4,
        hip: 0.3,
        shoulder: 0.15,
        elbow: 3,
        forearm: 2,
        wrist: 1.5,
        clavicle: 1.5,
      },
      obstacles: [],
      progress: (frame) => anchorPoint(body, frame, "grip_L").y,
      ground: "heel_L",
      props: DUMBBELLS,
      propState: (frame) =>
        SIDES.map((side) => {
          const grip = anchorPoint(body, frame, `grip_${side}`);
          const quat = frame.rot[body.index[`wrist_${side}`]].clone().multiply(HANDLE);
          return { pos: [grip.x, grip.y, grip.z], quat: [quat.x, quat.y, quat.z, quat.w] };
        }),
      equipment: () => [],
      loads: SIDES.map((side) => ({ anchor: `grip_${side}`, share: 1, grip: "hang" as const })),
      support: { kind: "standing", brace: true },
      tempo: { lower: 2.2, bottom: 0.25, raise: 1.5, top: 0.8 },
      contacts: { dumbbell_L: { hand_L: 0.08 }, dumbbell_R: { hand_R: 0.08 } },
      required: [
        { label: "Left hand on its dumbbell", anchor: "grip_L", prop: "dumbbell_L" },
        { label: "Right hand on its dumbbell", anchor: "grip_R", prop: "dumbbell_R" },
        { label: "Left heel on the floor", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel on the floor", anchor: "heel_R", surfaceY: 0 },
        { label: "Left forefoot on the floor", anchor: "ballIn_L", surfaceY: 0 },
        { label: "Right forefoot on the floor", anchor: "ballIn_R", surfaceY: 0 },
      ],
      checks: [
        {
          id: "stance",
          label: "Hip-width stance",
          cue: "Stand upright with approximately a hip-width stance while holding the dumbbells by your thighs with straight elbows.",
          evaluate: ({ frames, top }) => {
            const feet =
              anchorPoint(body, frames[top], "heel_L").x -
              anchorPoint(body, frames[top], "heel_R").x;
            const hips = frames[top].pos[body.index.hip_L].x - frames[top].pos[body.index.hip_R].x;
            return {
              pass: within(feet / hips, 0.8, 1.5),
              measured: `heels ${(feet * 100).toFixed(0)} cm apart, hip joints ${(hips * 100).toFixed(0)} cm`,
            };
          },
        },
        {
          id: "straight-elbows",
          label: "Elbows stay straight",
          cue: "Continue keeping your elbows straight with the dumbbells just in front of your legs.",
          evaluate: (context) =>
            everyFrame(
              context,
              (_, a) => deg(Math.max(a["elbow_L.flex"], a["elbow_R.flex"])),
              10,
              "° of elbow bend",
            ),
        },
        {
          id: "semi-overhand",
          label: "Semi-overhand grip held throughout",
          cue: "Your palms face at an angle between backward and in toward each other. Keep your palms facing this way throughout your set.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const palm = new Vector3(-1, 0, 0).applyQuaternion(frame.rot[body.index.wrist_L]);
                const back = new Vector3(0, 0, -1)
                  .applyQuaternion(frame.rot[body.index.pelvis])
                  .setY(0)
                  .normalize();
                const inward = new Vector3(-1, 0, 0);
                const angle = deg(Math.atan2(palm.dot(back), palm.dot(inward)));
                return Math.abs(angle - 45);
              },
              25,
              "° away from halfway between backward and inward",
            ),
        },
        {
          id: "close-to-legs",
          label: "Dumbbells stay just in front of the legs",
          cue: "Avoid letting the dumbbells drift forward away from you.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const grip = anchorPoint(body, frame, "grip_L");
                return (
                  (grip.distanceTo(besideLeg(body, frame, "L", grip.y, new Vector3())) +
                    CLEARANCE) *
                  100
                );
              },
              4,
              " cm off the leg",
            ),
        },
        {
          id: "vertical-shins",
          label: "Shins stay vertical",
          cue: "Most of the motion should come from your hips, and your shins should remain in a vertical position throughout your set.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) => {
                const shin = frame.pos[body.index.knee_L]
                  .clone()
                  .sub(frame.pos[body.index.ankle_L]);
                return Math.abs(deg(Math.atan2(shin.z, shin.y)));
              },
              7,
              "° off vertical",
            ),
        },
        {
          id: "soft-knees",
          label: "Knees bend mildly, never locked",
          cue: "You should not keep your knees fully straightened. The appropriately mild degree of knee bend can naturally occur when you sit your buttocks backward.",
          evaluate: ({ angles, bottom }) => {
            const knee = deg(angles[bottom]["knee_L.flex"]);
            return {
              pass: within(knee, 8, 30),
              measured: `${knee.toFixed(0)}° of knee bend at the bottom`,
            };
          },
        },
        {
          id: "hinge",
          label: "Motion comes from the hips",
          cue: "Most of the motion should come from your hips.",
          evaluate: ({ angles, top, bottom }) => {
            const hip = deg(angles[bottom]["hip_L.flex"] - angles[top]["hip_L.flex"]);
            const knee = deg(angles[bottom]["knee_L.flex"] - angles[top]["knee_L.flex"]);
            return {
              pass: hip > 3 * knee,
              measured: `hips move ${hip.toFixed(0)}°, knees ${knee.toFixed(0)}°`,
            };
          },
        },
        {
          id: "flat-back",
          label: "Lower back stays flat",
          cue: "Hinge at your hips in a controlled manner as you keep your lower back flat, chest up, and core braced.",
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
          id: "below-knees",
          label: "Dumbbells reach below the knees",
          cue: "Lifters with normal flexibility can typically lower the dumbbells at least below their knees.",
          evaluate: ({ frames, bottom }) => {
            const below =
              frames[bottom].pos[body.index.knee_L].y -
              anchorPoint(body, frames[bottom], "grip_L").y;
            return {
              pass: below > 0,
              measured: `handles ${(Math.abs(below) * 100).toFixed(0)} cm ${below > 0 ? "below" : "above"} the knee joint`,
            };
          },
        },
        {
          id: "hamstring-end-range",
          label: "Descent stops at the hamstrings’ end range",
          cue: "Once you have achieved what feels like the end range to which your hamstrings can safely stretch and can no longer sit back any farther, you have reached your personal end range.",
          evaluate: ({ angles, bottom }) => {
            const stretch = stretchOf("hamstrings", angles[bottom], "L");
            return {
              pass: within(stretch, 0.7, 1),
              measured: `hamstrings at ${(stretch * 100).toFixed(0)}% of their end range`,
            };
          },
        },
        {
          id: "neck-neutral",
          label: "Neck stays near neutral",
          cue: "Keep the soles of your feet fully planted on the ground and your neck near a neutral position.",
          evaluate: (context) =>
            everyFrame(context, (_, a) => Math.abs(deg(a["neck.flex"])), 15, "° from neutral"),
        },
        {
          id: "stacked-at-top",
          label: "Shoulders, hips and mid-foot in line at the top",
          cue: "When you have finished lifting the dumbbells, you should be able to draw a straight line from your shoulders through your hips to the middle of your feet when viewed from the side.",
          evaluate: ({ frames, top }) => {
            const frame = frames[top];
            const shoulder = frame.pos[body.index.shoulder_L];
            const hip = frame.pos[body.index.hip_L];
            const foot = anchorPoint(body, frame, "heel_L").z + 0.05 + 0.04;
            const t = hip.y / shoulder.y;
            const off = hip.z - (foot + (shoulder.z - foot) * t);
            return {
              pass: Math.abs(off) < 0.04 && shoulder.z > hip.z - 0.03,
              measured: `hips ${(Math.abs(off) * 100).toFixed(1)} cm off the shoulder to mid-foot line`,
            };
          },
        },
      ],
    };
  },
};
