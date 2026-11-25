import { Vector3 } from "three";
import { anchorPoint, type Body } from "../body";
import { everyFrame } from "../checks";
import type { FormCheck } from "../exercise";
import { carried, holdGrasp } from "../grasp";
import { legPress45Machine } from "../machines";
import {
  checkFlatBack,
  checkJointRange,
  checkJointWithinAt,
  checkNeutralNeck,
  plantBothFeetOnPlate,
  POSTURE_HINTS,
  restBackOnPad,
} from "../postures";
import { composeExercise } from "../scene";
import { kneeOffFootLine, lockAngle, mirrored, restOnPlane } from "../solver";

const KG = 100;
const STANCE_X = 0.22;
const TOE_OUT = 0.45;
/** Heels this far up the footplate from its lower edge: the feet sit in the middle of the platform. */
const HEEL_ALONG = 0.15;
/** The sled's travel up its rail is solved with the pose, as the one extra unknown. */
const SLED_TOP = 0.51;
/** Along the rail, only the sled's weight component pushes back on the feet. */
const ALONG_RAIL = Math.SQRT1_2;

const machine = legPress45Machine({ drive: (_frame, extras) => ({ sledTravel: extras[0] }) });

const checks = (body: Body): FormCheck[] => [
  checkJointWithinAt(
    "depth",
    "Lowers to the hips’ end range",
    "If you reached the end range to which your hips can bend, lowering the sled any further would cause your lower back to start rounding. This would be demonstrated by your buttocks starting to curl up off the seat.",
    "hip_L.flex",
    "peak",
    118,
    126,
  ),
  checkJointWithinAt(
    "soft-lockout",
    "Knees straight or just bent at the top",
    "Based on your preference, you can finish with your knees fully straightened or ever so slightly bent.",
    "knee_L.flex",
    "start",
    0,
    25,
  ),
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
  checkJointRange("knee-range", "Knees travel through the rep", "Lower the sled toward you in a controlled manner by simultaneously bending at your knees and hips.", "knee_L.flex", 55),
  checkFlatBack("Continue lowering the sled through the full range of motion you can while keeping your buttocks firmly on the seat, lower back flat against the backrest"),
  checkNeutralNeck("Regardless, keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
];

export const spec = composeExercise({
  id: "45-deg-leg-press",
  catalogId: "1a25c6f170d88079a926dde776766181",
  name: "45° Leg Press",
  defaultLoadKg: KG,
  loadUnit: "total",
  machines: machine,
  setup(body, ctx) {
    const seat = machine.surfaces!.seat;
    const back = machine.surfaces!.back;
    const plate = machine.footplates!.sled.surface;
    const rail = machine.rails!.sled;
    const grasps = [machine.grasp("L", "handle_L"), machine.grasp("R", "handle_R")];
    const s = POSTURE_HINTS.incline45;
    const seatedAt = { "root.y": 0.52, "root.z": -0.4 };
    const arms = { "shoulder.elev": 25, "shoulder.plane": 60, "elbow.flex": 20, "forearm.pron": 0, "clavicle.prot": 0, "clavicle.elev": 0 };
    return {
      hints: {
        start: { ...s, ...seatedAt, ...arms, "hip.flex": 62, "hip.abd": 12, "hip.rot": 10, "knee.flex": 18, "ankle.dorsi": 0 },
        end: { ...s, ...seatedAt, ...arms, "hip.flex": 112, "hip.abd": 16, "hip.rot": 10, "knee.flex": 100, "ankle.dorsi": 20 },
      },
      extras: 1,
      extraStart: [SLED_TOP],
      goals: [
        ...restBackOnPad(body, back),
        restOnPlane(body, "pelvisBottom", new Vector3(...seat.origin), new Vector3(...seat.normal), 30, 0.01),
        ...plantBothFeetOnPlate(body, plate, STANCE_X, HEEL_ALONG, TOE_OUT, 40, carried(machine.carrier("sled")!, ctx.live)),
        // The fixed handles run fore and aft beside the hips, so a straight-on wrap would need the forearm square to them;
        // a softer alignment lets the wrist deviate and the hand sit toward the handle’s rear end, as a seated lifter holds them.
        ...grasps.flatMap((g) => holdGrasp(body, g, ctx.live, { style: "neutral", align: 3, at: -0.07 })),
        // The machine clamps the sled to its rail, which leaves the solver no gradient past the stops; keep it on the rail.
        ({ q, push }) => {
          const t = q[body.dofCount];
          push(40 * (Math.max(0, t - rail.maxTravel) + Math.min(0, t - rail.minTravel)));
        },
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [
          lockAngle(body, "knee_L.flex", 15, 10),
          // Seed the top of the rep near where slightly bent knees put the sled; the solve settles it from there.
          ({ q, push }) => push(q[body.dofCount] - SLED_TOP),
        ],
        // The backrest is fixed at 42°, so the hips start near 90° of flexion and reach their end range (125°) with the
        // knees near 80°; going deeper would curl the buttocks off the seat, which the cues rule out.
        end: [lockAngle(body, "knee_L.flex", 80, 10)],
      },
      stiffness: { default: 1, lumbar: 10, thoracic: 10, neck: 4, clavicle: 12 },
      progress: (frame) => anchorPoint(body, frame, "heel_L").y,
      ground: "sacrum",
      grasps,
      loads: (["L", "R"] as const).flatMap((side) =>
        (["heel", "ballIn"] as const).map((point) => ({
          anchor: `${point}_${side}`,
          share: 0.25 * ALONG_RAIL,
          grip: "rest" as const,
          direction: [0, -Math.SQRT1_2, -Math.SQRT1_2] as [number, number, number],
        })),
      ),
      support: { kind: "supported", rail: true, passive: ["lumbar", "thoracic"], brace: true },
      required: [
        { label: "Seat", anchor: "pelvisBottom", part: "leg-press-45.seat_pad" },
        { label: "Backrest", anchor: "upperBack", part: "leg-press-45.back_pad" },
        { label: "Left heel", anchor: "heel_L", part: "leg-press-45.footplate" },
        { label: "Right heel", anchor: "heel_R", part: "leg-press-45.footplate" },
        { label: "Left forefoot", anchor: "ballIn_L", part: "leg-press-45.footplate" },
        { label: "Right forefoot", anchor: "ballIn_R", part: "leg-press-45.footplate" },
      ],
      checks: checks(body),
      cameraHint: { view: "Side" },
    };
  },
});
