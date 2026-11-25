import { Vector3 } from "three";
import { anchorPoint, worldPoint, type Body, type Frame } from "../body";
import { everyFrame } from "../checks";
import type { FormCheck } from "../exercise";
import { graspProp, holdGrasp } from "../grasp";
import { loadedBarbell, powerRackMachine, propHandles } from "../machines";
import type { PropState } from "../equipment";
import {
  checkFeetPlanted,
  checkFlatBack,
  checkJointWithinAt,
  checkNeutralNeck,
  plantBothFeet,
  POSTURE_HINTS,
} from "../postures";
import { composeExercise } from "../scene";
import { balance, kneeOffFootLine, kneeOverToes, lockAngle, mirrored } from "../solver";

const KG = 100;
const HEEL_Z = -0.16;
const STANCE_X = 0.16;
const TOE_OUT = 0.38;
const MIDFOOT_Z = HEEL_Z + 0.1;
const HAND_AT = 0.44;
/** The bar's axis on the upper traps, in the thoracic frame: just above and behind the `traps` anchor. */
const BAR_ON_BACK = new Vector3(0, 0.3, -0.085);
/** J-hook cradle just under where the bar rides when standing, so the bar clears it by a couple of centimetres. */
const HOOK_Y = 1.43;
/** Safety arms just under the bar's lowest point. */
const SAFETY_Y = 0.86;

const barPoint = new Vector3();
const barState = (body: Body, frame: Frame): PropState => {
  worldPoint(frame, body.index.thoracic, BAR_ON_BACK, barPoint);
  return { pos: [barPoint.x, barPoint.y, barPoint.z], quat: [0, 0, 0, 1] };
};

const thighAngle = (body: Body, frame: Frame) => {
  const hip = frame.pos[body.index.hip_L];
  const knee = frame.pos[body.index.knee_L];
  return (Math.atan2(hip.y - knee.y, Math.hypot(hip.x - knee.x, hip.z - knee.z)) * 180) / Math.PI;
};

const checks = (body: Body): FormCheck[] => [
  {
    id: "depth",
    label: "Thighs reach about parallel",
    cue: "People can often descend at least until their thighs are fairly close to being parallel to the ground",
    evaluate: ({ frames, bottom }) => {
      const a = thighAngle(body, frames[bottom]);
      return { pass: a < 12, measured: `thigh is ${a.toFixed(0)}° above parallel at the bottom (target < 12°)` };
    },
  },
  {
    id: "knees-track-toes",
    label: "Knees track over the toes",
    cue: "Strive to keep each knee aligned with the second toe (the toe next to your big toe) or the third toe of that side's foot as you avoid letting your knees cave inward relative to your feet.",
    evaluate: (context) =>
      everyFrame(
        context,
        (frame) => Math.max(...(["L", "R"] as const).map((s) => Math.abs(kneeOffFootLine(body, frame, s)))) * 100,
        4,
        " cm off the foot line",
      ),
  },
  {
    id: "bar-over-midfoot",
    label: "Bar stays over midfoot",
    cue: "your weight is evenly distributed throughout your feet (rather than being all on your heels or toes) during your set.",
    evaluate: (context) =>
      everyFrame(context, (frame) => Math.abs(barState(body, frame).pos[2] - MIDFOOT_Z) * 100, 6, " cm from midfoot"),
  },
  checkJointWithinAt("stand-tall", "Stands fully upright at the top", "Reverse the movement by driving through the ground while extending (straightening) your knees and hips to stand upright.", "knee_L.flex", "start", 0, 10),
  checkFeetPlanted("Keep the entire sole of each foot (including the heel, outer aspect of the midfoot, and inner aspect of the midfoot) firmly planted on the ground"),
  checkFlatBack("Progressively bend at your knees and hips to squat down in a controlled manner while keeping your chest up and back flat."),
  checkNeutralNeck("Throughout your set, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
];

export const spec = composeExercise({
  id: "barbell-back-squat",
  catalogId: "1a25c6f170d8803d8231d083fdd65458",
  name: "Barbell Back Squat",
  defaultLoadKg: KG,
  loadUnit: "total",
  machines: powerRackMachine({ hookY: HOOK_Y, safetyY: SAFETY_Y }),
  setup(body, ctx) {
    const bar = loadedBarbell("bar", KG);
    const handle = propHandles("prop-barbell").grip;
    const grasps = [graspProp("L", "bar", handle), graspProp("R", "bar", handle)];
    const s = POSTURE_HINTS.standing;
    const arms = {
      "shoulder.elev": 75,
      "shoulder.plane": -15,
      "shoulder.twist": -70,
      "elbow.flex": 110,
      "forearm.pron": 70,
      "clavicle.prot": -15,
    };
    const feet = { "hip.abd": 14, "hip.rot": 22 };
    return {
      hints: {
        start: { ...s, ...arms, ...feet, "root.z": MIDFOOT_Z - 0.02 },
        end: {
          ...s,
          ...arms,
          ...feet,
          "root.y": 0.52,
          "root.z": -0.22,
          "root.pitch": 38,
          "hip.flex": 112,
          "hip.abd": 24,
          "knee.flex": 118,
          "ankle.dorsi": 30,
          "neck.flex": -10,
        },
      },
      goals: [
        ...plantBothFeet(body, STANCE_X, HEEL_Z, TOE_OUT),
        balance(body, [{ anchor: "traps", kg: KG }], MIDFOOT_Z, 25),
        kneeOverToes(body, "L", 30),
        kneeOverToes(body, "R", 30),
        ...grasps.flatMap((g) => holdGrasp(body, g, ctx.live, { at: g.side === "L" ? HAND_AT : -HAND_AT, style: "overhand" })),
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [lockAngle(body, "knee_L.flex", 3, 10), lockAngle(body, "hip_L.flex", 3, 10)],
        end: [lockAngle(body, "knee_L.flex", 118, 10)],
      },
      stiffness: { default: 1, lumbar: 10, thoracic: 10, neck: 4 },
      progress: (frame) => anchorPoint(body, frame, "traps").y,
      ground: "heel_L",
      props: bar.props,
      propState: (frame) => bar.states(barState(body, frame)),
      grasps,
      loads: [{ anchor: "traps", share: 1, grip: "rest" }],
      support: { kind: "standing", brace: true },
      required: [
        { label: "Left heel", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel", anchor: "heel_R", surfaceY: 0 },
        { label: "Left ball", anchor: "ballIn_L", surfaceY: 0 },
        { label: "Right ball", anchor: "ballIn_R", surfaceY: 0 },
      ],
      checks: checks(body),
      cameraHint: { view: "Side" },
    };
  },
});

