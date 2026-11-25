import { Vector3 } from "three";
import { anchorPoint, SIDES, type Body } from "../body";
import { everyFrame } from "../checks";
import { footContact, type FormCheck } from "../exercise";
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
const HEEL_ALONG = 0.24;
/** The sled's travel up its rail is solved with the pose, as the one extra unknown. */
const SLED_TOP = 0.6;
/** Along the rail, only the sled's weight component pushes back on the feet. */
const ALONG_RAIL = Math.SQRT1_2;

const machine = legPress45Machine({ drive: (_frame, extras) => ({ sledTravel: extras[0] }) });

const checks = (body: Body): FormCheck[] => [
  ...(["L", "R"] as const).flatMap((side) => [
    checkJointWithinAt(
      `depth-${side}`,
      `${side === "L" ? "Left" : "Right"} knee bends to at least 90°`,
      "People can commonly lower the sled until their knees are bent by at least 90 degrees.",
      `knee_${side}.flex`,
      "peak",
      88,
      115,
    ),
    checkJointWithinAt(
      `soft-lockout-${side}`,
      `${side === "L" ? "Left" : "Right"} knee straight or just bent at the top`,
      "Based on your preference, you can finish with your knees fully straightened or ever so slightly bent.",
      `knee_${side}.flex`,
      "start",
      0,
      15,
    ),
  ]),
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
        // The sacrum settles wherever the seat lets it; pinning it in the corner lifts the pelvis off the seat.
        ...restBackOnPad(body, back, { sacrumAlong: null }),
        restOnPlane(body, "occiput", new Vector3(...back.origin), new Vector3(...back.normal), 30, 0.004),
        restOnPlane(body, "pelvisBottom", new Vector3(...seat.origin), new Vector3(...seat.normal), 30, 0.01),
        ...plantBothFeetOnPlate(body, plate, STANCE_X, HEEL_ALONG, TOE_OUT, 40, carried(machine.carrier("sled")!, ctx.live)),
        ...grasps.flatMap((g) => holdGrasp(body, g, ctx.live, { style: "neutral" })),
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [
          lockAngle(body, "knee_L.flex", 6, 60),
          // Seed the top of the rep near where slightly bent knees put the sled; the solve settles it from there.
          ({ q, push }) => push(q[body.dofCount] - SLED_TOP),
        ],
        end: [lockAngle(body, "knee_L.flex", 92, 10)],
      },
      stiffness: { default: 1, lumbar: 10, thoracic: 10, neck: 4, clavicle: 12 },
      progress: (frame) => anchorPoint(body, frame, "heel_L").y,
      ground: "sacrum",
      grasps,
      loads: [],
      support: {
        kind: "supported",
        rail: true,
        passive: ["lumbar", "thoracic", "neck"],
        // The sled presses both soles down its rails with the part of its weight the rails don't carry.
        contacts: [
          {
            kind: "rest",
            anchors: SIDES.flatMap((side) => footContact(side).anchors),
            normal: [0, -Math.SQRT1_2, -Math.SQRT1_2],
            share: ALONG_RAIL,
          },
        ],
      },
      required: [
        { label: "Seat", anchor: "pelvisBottom", part: "leg-press-45.seat_pad" },
        { label: "Backrest", anchor: "upperBack", part: "leg-press-45.back_pad" },
        { label: "Head", anchor: "occiput", part: "leg-press-45.back_pad" },
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
