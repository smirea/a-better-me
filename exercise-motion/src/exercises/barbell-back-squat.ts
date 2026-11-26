import { Vector3 } from "three";
import { anchorPoint, SIDES, type Body, type Frame, type Side } from "../body";
import { everyFrame } from "../checks";
import type { FormCheck, CheckContext } from "../exercise";
import { graspProp, holdGrasp } from "../grasp";
import { deg } from "../math";
import { loadedBarbell, powerRackMachine, propHandles, rackHeightsFor } from "../machines";
import { checkFlatBack, checkNeutralNeck, plantBothFeet, POSTURE_HINTS } from "../postures";
import { composeExercise } from "../scene";
import { kneeOffFootLine, lockAngle, mirrored, within } from "../solver";

const LOAD_KG = 60;
const BAR_R = 0.0145;
/** Shaft centre sits this far off the traps, just clear of the skin. */
const BAR_SEAT = BAR_R + 0.006;
const STANCE_X = 0.24;
const HEEL_Z = -0.04;
/** Just outside the shoulders. Closer than this, the forearm can't both reach the shaft and run across it. */
const GRIP = 0.39;
/**
 * Elbows down, forearms up to a bar on the traps. Searched against the traps seat: the grip centre
 * lands on the shaft and the fingers stay within about 15° of it, clear of the shoulder and wrist stops.
 */
const ARM = {
  "clavicle.prot": -22,
  "clavicle.elev": -4,
  "shoulder.elev": 36,
  "shoulder.plane": -37,
  "shoulder.twist": -80,
  "elbow.flex": 140,
  "forearm.pron": 6,
  "wrist.flex": -70,
  "wrist.dev": -5,
} as const;
/**
 * Underside of the shaft once the rep is solved: standing, then the bottom.
 * `rackHeightsFor` puts the J-hook lips just under the standing bar and the safeties just under the bottom.
 */
const RACK = rackHeightsFor(1.433, 0.959);

const stand = POSTURE_HINTS.standing;

function barOnBack(body: Body, frame: Frame) {
  const traps = anchorPoint(body, frame, "traps");
  const back = new Vector3(0, 0, -1).applyQuaternion(frame.rot[body.index.thoracic]);
  traps.addScaledVector(back, BAR_SEAT);
  return { pos: [traps.x, traps.y, traps.z] as [number, number, number], quat: [0, 0, 0, 1] as [number, number, number, number] };
}

/** Hip joint above the knee joint, in metres. Zero is a thigh parallel to the floor; negative is below parallel. */
function thighAboveParallel(body: Body, frame: Frame, side: Side): number {
  return frame.pos[body.index[`hip_${side}`]].y - frame.pos[body.index[`knee_${side}`]].y;
}

function barGap(context: CheckContext, index: number): number {
  const frame = context.frames[index];
  const traps = anchorPoint(context.body, frame, "traps");
  const pos = context.sequence.propStates[index][0].pos;
  return Math.hypot(pos[0] - traps.x, pos[1] - traps.y, pos[2] - traps.z);
}

const checks: FormCheck[] = [
  {
    id: "upright-top",
    label: "Stands tall at the top",
    cue: "Stand upright by straightening your knees and hips.",
    evaluate: ({ angles, top }) => {
      const a = angles[top];
      const knee = Math.max(deg(a["knee_L.flex"]), deg(a["knee_R.flex"]));
      const hip = Math.max(deg(a["hip_L.flex"]), deg(a["hip_R.flex"]));
      return {
        pass: knee <= 12 && hip <= 18,
        measured: `knees ${knee.toFixed(0)}°, hips ${hip.toFixed(0)}° at the top`,
      };
    },
  },
  {
    id: "parallel",
    label: "Thighs reach parallel",
    cue: "Descend at least until the thighs are fairly close to being parallel to the ground.",
    evaluate: ({ body, frames, bottom }) => {
      const above = Math.max(
        ...SIDES.map((side) => thighAboveParallel(body, frames[bottom], side)),
      );
      return {
        pass: above <= 0.06,
        measured: `hip finishes ${(above * 100).toFixed(1)} cm above the knee`,
      };
    },
  },
  {
    id: "knees-over-toes",
    label: "Knees stay over the feet",
    cue: "Keep each knee aligned with the second or third toe, and avoid letting the knees cave inward.",
    evaluate: (context) =>
      everyFrame(context, (frame) => {
        let worst = 0;
        for (const side of SIDES) worst = Math.max(worst, Math.abs(kneeOffFootLine(context.body, frame, side)));
        return worst * 100;
      }, 4, " cm off the toe line"),
  },
  {
    id: "soles-planted",
    label: "Soles stay planted",
    cue: "Keep the entire sole of each foot firmly planted on the ground.",
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
  {
    id: "bar-on-back",
    label: "Bar stays on the upper back",
    cue: "The bar should be securely resting on the muscles of your upper back, and you maintain this bar position throughout the set.",
    evaluate: (context) =>
      everyFrame(context, (_frame, _angles, index) => Math.abs(barGap(context, index) - BAR_SEAT) * 1000, 8, " mm off the traps"),
  },
];

/** Roughly how far the pelvis tips forward at the top, in degrees: only where the solve starts looking. */
const TOP_PITCH = 16;

export const spec = composeExercise({
  id: "barbell-back-squat",
  catalogId: "1a25c6f170d8803d8231d083fdd65458",
  name: "Barbell Back Squat",
  defaultLoadKg: LOAD_KG,
  loadUnit: "total",
  machines: () => powerRackMachine({ ...RACK }),
  setup(body, ctx) {
    const handle = propHandles("prop-barbell").grip;
    const loaded = loadedBarbell("bar", LOAD_KG);
    const props = loaded.props;
    const grasps = [graspProp("L", "bar", handle), graspProp("R", "bar", handle)];
    // Standing, the torso tips forward far enough to carry the bar over the base of the spine. Bolt upright, a bar
    // on the traps sits behind the spine and the abdominals have to hold the lifter from folding backward.
    const tall = {
      ...stand,
      "root.pitch": TOP_PITCH,
      "hip.flex": TOP_PITCH - 1,
      "hip.abd": 16,
      "hip.rot": 8,
      "knee.flex": 6,
      "ankle.dorsi": 4,
      "lumbar.flex": -4,
      "thoracic.flex": -4,
      "neck.flex": 0,
      ...ARM,
    };
    return {
      hints: {
        start: tall,
        end: {
          ...tall,
          "root.y": 0.5,
          "root.z": -0.06,
          "root.pitch": 42,
          "hip.flex": 124,
          "hip.abd": 28,
          "hip.rot": 20,
          "knee.flex": 124,
          "ankle.dorsi": 28,
        },
      },
      goals: [
        ...plantBothFeet(body, STANCE_X, HEEL_Z, 0.52, 0, 140),
        mirrored(body, 40),
        ...SIDES.flatMap((side) => [
          ...holdGrasp(body, grasps[side === "L" ? 0 : 1], ctx.live, {
            at: side === "L" ? GRIP : -GRIP,
            style: "overhand",
            weight: 80,
            align: 3,
            wrist: 0,
          }),
          within(({ frame }) => kneeOffFootLine(body, frame, side), -0.025, 0.025, 300),
        ]),
        lockAngle(body, "lumbar.flex", -4, 16),
        lockAngle(body, "thoracic.flex", -4, 14),
        lockAngle(body, "neck.flex", 0, 8),
      ],
      effort: true,
      keyGoals: {
        start: [lockAngle(body, "knee_L.flex", 6, 60), lockAngle(body, "knee_R.flex", 6, 60)],
        // The rep ends where the cue says it may: thighs "fairly close to parallel", the hip within a few
        // centimetres above the knee or just below it.
        end: SIDES.map((side) => within(({ frame }) => thighAboveParallel(body, frame, side), -0.02, 0.04, 300)),
      },
      stiffness: { default: 0.3, root: 0.3 },
      progress: (frame) => -frame.pos[body.index.hip_L].y,
      ground: "heel_L",
      props,
      propState: (frame) => loaded.states(barOnBack(body, frame)),
      grasps,
      loads: [{ anchor: "traps", share: 1, grip: "hang" }],
      support: { kind: "standing" },
      required: SIDES.flatMap((side) =>
        (["heel", "ballIn", "ballOut", "toe"] as const).map((part) => ({
          label: `${side === "L" ? "Left" : "Right"} ${part}`,
          anchor: `${part}_${side}`,
          surfaceY: 0,
        })),
      ),
      checks: [
        ...checks,
        checkNeutralNeck(
          "Keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright.",
        ),
        checkFlatBack(
          "Squat down while keeping your chest up and back flat. Avoid letting your lower back round or your chest cave down.",
          8,
        ),
      ],
      cameraHint: { view: "Side" },
    };
  },
});
