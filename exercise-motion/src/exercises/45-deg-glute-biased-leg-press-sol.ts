import { Quaternion, Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Frame, type PoseHints, type Side } from "../body";
import { everyFrame } from "../checks";
import { box, cylinder, IDENTITY, quatEuler, quatOf } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { deg, lerp, rad } from "../math";
import { checkFlatBack, PAD_RESTING } from "../postures";
import { aim, lockAngle, mirrored, pin, restOnPlane, type Goal, type GoalContext } from "../solver";

const rail = new Vector3(0, Math.SQRT1_2, Math.SQRT1_2);
// Plane normal measured on the tread after rescaling the imported rails to 45°.
const pitch = Math.atan2(-0.423, 0.906 / Math.tan(rad(40))) - Math.PI / 2;
const footTilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch);
const contactNormal = new Vector3(0, 1, 0).applyQuaternion(footTilt);
const heelOnPlate = new Vector3(0, 1.084, (0.5807 - 0.423 * 1.084) / (0.906 / Math.tan(rad(40))));
const platform = new Vector3(0, 1.097, (0.5807 - 0.423 * 1.097) / (0.906 / Math.tan(rad(40))));
const backPitch = Math.atan2(0.5 / Math.tan(rad(40)), 0.866);
const backNormal = new Vector3(0, Math.cos(backPitch), Math.sin(backPitch));
const back = new Vector3(0, 0.456, -0.681);
const seat = new Vector3(0, 0.329, -0.375);
const handle = (side: Side) => new Vector3(sideSign(side) * 0.35, 0.23, -0.437);
const handleAxis = new Vector3(0, 0.725, 0.689);
const footAnchors = ["heel", "ballIn", "ballOut", "toe"];
const common: PoseHints = {
  "root.y": 0.388,
  "root.z": -0.411,
  "root.pitch": -74,
  "lumbar.flex": 21,
  "thoracic.flex": 0,
  "neck.flex": 19,
  "shoulder.elev": 22,
  "shoulder.plane": -25,
  "shoulder.twist": 15,
  "elbow.flex": 13,
  "forearm.pron": 12,
};

export const spec: ExerciseSpec = {
  id: "45-deg-glute-biased-leg-press-sol",
  catalogId: "2aa5c6f170d880c08fcbf27e03a0e2dc",
  name: "45° Glute-Biased Leg Press (sol)",
  defaultLoadKg: 40,
  loadUnit: "total",
  build(body) {
    const travel = (u: number) => rail.clone().multiplyScalar(lerp(0.018, -0.238, u));
    const spot = (anchor: string, side: Side, u: number) => {
      const offset = body.anchors[`${anchor}_${side}`].local
        .clone()
        .sub(body.anchors[`heel_${side}`].local);
      offset
        .applyAxisAngle(new Vector3(0, 1, 0), sideSign(side) * rad(7))
        .applyQuaternion(footTilt);
      return heelOnPlate
        .clone()
        .setX(sideSign(side) * 0.214)
        .add(offset)
        .add(travel(u));
    };
    const shinOffset = (frame: Frame, side: Side) => {
      const ankle = body.index[`ankle_${side}`];
      const knee = body.index[`knee_${side}`];
      const acrossFoot = new Vector3(1, 0, 0).applyQuaternion(frame.rot[ankle]);
      return frame.pos[knee].clone().sub(frame.pos[ankle]).dot(acrossFoot);
    };
    const phase =
      (target: number): Goal =>
      ({ q, push }) =>
        push(650 * (q[body.dofCount] - target));
    return {
      hints: {
        start: {
          ...common,
          "hip.flex": 94,
          "hip.abd": 9,
          "hip.rot": 8,
          "knee.flex": 15,
          "ankle.dorsi": -38,
        },
        end: {
          ...common,
          "hip.flex": 119,
          "hip.abd": 16,
          "hip.rot": 14,
          "knee.flex": 105,
          "ankle.dorsi": -38,
        },
      },
      extras: 1,
      extraStart: [0],
      path: (u) => [u],
      keyGoals: { start: [phase(0)], end: [phase(1)] },
      goals: [
        pin(body, "pelvis", () => new Vector3(0, 0.388, -0.411), 135),
        restOnPlane(body, "upperBack", back, backNormal, 250, 0.006),

        restOnPlane(body, "pelvisBottom", seat, rail.clone().setZ(-rail.z), 110, 0.001),
        ...SIDES.flatMap((side) => [
          ...footAnchors.map((anchor) =>
            pin(body, `${anchor}_${side}`, (q) => spot(anchor, side, q[body.dofCount]), 340),
          ),
          ({ frame, push }: GoalContext) => push(45 * shinOffset(frame, side)),
          pin(body, `grip_${side}`, () => handle(side), 160),
          aim(
            body,
            `wrist_${side}`,
            new Vector3(0, 0, 1),
            handleAxis.clone().multiplyScalar(sideSign(side)),
            7,
          ),
        ]),
        ({ q, push }) => push(140 * (q[3] - rad(-74))),
        lockAngle(body, "lumbar.flex", 21, 100),
        lockAngle(body, "thoracic.flex", 0, 85),
        ...SIDES.map((side) =>
          pin(body, `knee_${side}`, () => new Vector3(sideSign(side) * 0.227, 0, 0), 120, "x"),
        ),
        mirrored(body, 90),
      ],
      stiffness: {
        default: 0.8,
        root: 20,
        lumbar: 15,
        thoracic: 20,
        neck: 12,
        clavicle: 8,
        hip: 1.2,
        shoulder: 2,
        wrist: 3,
      },
      obstacles: [],
      ground: "sacrum",
      progress: (frame) => anchorPoint(body, frame, "heel_L").dot(rail),
      props: [
        {
          id: "sled",
          kind: "glb",
          glbId: "linear-leg-press-sled-sol",
          colliders: [
            box(
              "sled.platform",
              platform.clone().addScaledVector(contactNormal, -0.036).toArray(),
              [0.67, 0.072, 0.48],
              "steel",
              true,
              quatEuler(pitch, 0, 0),
            ),
          ],
        },
      ],
      propState: (_, [u]) => [{ pos: travel(u).toArray(), quat: IDENTITY }],
      equipment: () => [
        box(
          "seat.back",
          back.clone().addScaledVector(backNormal, -0.051).toArray(),
          [0.38, 0.102, 0.83],
          "pad",
          true,
          quatEuler(backPitch, 0, 0),
        ),
        box(
          "seat.base",
          seat
            .clone()
            .addScaledVector(new Vector3(0, Math.SQRT1_2, -Math.SQRT1_2), -0.05)
            .toArray(),
          [0.37, 0.1, 0.22],
          "pad",
          true,
          quatEuler(-rad(45), 0, 0),
        ),
        ...SIDES.flatMap((side) => [
          cylinder(
            `grab${side}`,
            handle(side).toArray(),
            0.02,
            0.165,
            "rubber",
            quatOf([0, -handleAxis.z, handleAxis.y], Math.PI / 2),
          ),
          cylinder(
            `rail${side}`,
            [sideSign(side) * 0.3, 0.948, 0.397],
            0.042,
            1.356,
            "chrome",
            quatOf([0, -1, 1], Math.PI / 2),
          ),
        ]),
      ],
      glb: [{ id: "linear-leg-press-sol", pos: [0, 0, 0], hideEquipment: true }],
      cameraHint: { view: "Back" },
      loads: SIDES.map((side) => ({
        anchor: `ballIn_${side}`,
        share: Math.SQRT1_2 / 2,
        grip: "press",
        direction: rail.clone().negate().toArray(),
      })),
      support: {
        kind: "seated",
        brace: true,
        rail: true,
        passive: [
          "pelvis",
          "lumbar",
          "thoracic",
          "neck",
          ...SIDES.flatMap((side) => [`shoulder_${side}`, `elbow_${side}`, `wrist_${side}`]),
        ],
      },
      tempo: { lower: 2.1, bottom: 0.25, raise: 1.45, top: 0.23 },
      grip: "hang",
      contacts: {
        "seat.back": { ...PAD_RESTING, upperarm_L: 0.04, upperarm_R: 0.04 },
        "seat.base": { ...PAD_RESTING, pelvis: 0.08, thigh_L: 0.066, thigh_R: 0.066 },
        "sled.platform": { foot_L: 0.015, foot_R: 0.015 },
        grabL: { hand_L: 0.06, forearm_L: 0.03 },
        grabR: { hand_R: 0.06, forearm_R: 0.03 },
      },
      required: [
        { label: "Glutes on seat", anchor: "pelvisBottom", part: "seat.base" },
        { label: "Back on pad", anchor: "upperBack", part: "seat.back" },
        ...SIDES.flatMap((side) => [
          { label: `${side} hand on fixed handle`, anchor: `grip_${side}`, part: `grab${side}` },
          ...footAnchors.map((anchor) => ({
            label: `${side} ${anchor} against platform`,
            anchor: `${anchor}_${side}`,
            prop: "sled",
          })),
        ]),
      ],
      checks: [
        checkFlatBack(
          "Continue keeping your buttocks firmly planted on the seat and your back snugly up against the backrest.",
          5,
        ),
        {
          id: "sole-contact",
          label: "Whole sole stays flush with the platform",
          cue: "Keep the entire sole of each foot (including the heel, outer aspect of the midfoot, and inner aspect of the midfoot) firmly planted on the platform.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame, _, i) => {
                const surface = platform
                  .clone()
                  .add(new Vector3(...context.sequence.propStates[i][0].pos));
                return (
                  100 *
                  Math.max(
                    ...SIDES.flatMap((side) =>
                      footAnchors.map((anchor) =>
                        Math.abs(
                          anchorPoint(body, frame, `${anchor}_${side}`)
                            .sub(surface)
                            .dot(contactNormal),
                        ),
                      ),
                    ),
                  )
                );
              },
              0.8,
              " cm plane deviation",
            ),
        },
        {
          id: "stance",
          label: "High, wide foot placement",
          cue: "Place your feet fully on the upper half of the foot platform, mildly outside shoulder width apart, with your toes pointing mildly outward.",
          evaluate: ({ frames, top, sequence }) => {
            const frame = frames[top];
            const lift = new Vector3(...sequence.propStates[top][0].pos);
            const platformUp = new Vector3(0, 0, 1).applyQuaternion(footTilt);
            const right = anchorPoint(body, frame, "heel_R");
            const left = anchorPoint(body, frame, "heel_L");
            const heel = left.clone().sub(lift).sub(platform).dot(platformUp);
            const toe = anchorPoint(body, frame, "toe_L").sub(lift).sub(platform).dot(platformUp);
            const width = left.x - right.x;
            return {
              pass: heel > -0.028 && toe <= 0.24 && width >= 0.4 && width <= 0.5,
              measured: `${(width * 100).toFixed(1)} cm between heels, ${((0.24 - toe) * 100).toFixed(1)} cm above toes`,
            };
          },
        },
        {
          id: "range",
          label: "Deep flexion to near extension",
          cue: "Lower the sled toward you in a controlled manner by simultaneously bending at your knees and hips.",
          evaluate: ({ angles, top, bottom }) => {
            const extended = deg(angles[top]["knee_L.flex"]);
            const flexed = deg(angles[bottom]["knee_L.flex"]);
            return {
              pass: extended >= 2 && extended <= 30 && flexed >= 82 && flexed <= 125,
              measured: `${extended.toFixed(1)}° to ${flexed.toFixed(1)}° knee flexion`,
            };
          },
        },
        {
          id: "knees",
          label: "Knees track outward over the feet",
          cue: "Strive to keep each knee aligned with the second toe or the third toe of that side’s foot.",
          evaluate: (context) =>
            everyFrame(
              context,
              (frame) =>
                100 *
                Math.max(
                  ...SIDES.map((side) => {
                    return Math.abs(shinOffset(frame, side));
                  }),
                ),
              4,
              " cm lateral tracking error",
            ),
        },
      ],
    };
  },
};
