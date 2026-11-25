import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type Side } from "../body";
import { buildExerciseSpec, lockTorsoPitch, POSTURE_HINTS, propAtGrip, quatFromAxisX } from "../builders";
import { everyFrame } from "../checks";
import type { PropState } from "../equipment";
import type { Built, ExerciseSpec, FormCheck } from "../exercise";
import { closestSegments, type Vec3 } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { capsulesInWorld, newCapsules, pin, type Goal } from "../solver";

/**
 * Real dual adjustable pulley (functional trainer) GLB with its hanging cable stubs removed in Blender, so the
 * live cables leave the actual sheaves. The machine faces the lifter (-Z); sheave centres were measured in the
 * GLB at x = +0.657 / -0.753, y = 1.897, z = -0.58 (radius ~7 cm), then shifted by `MACHINE_POS`.
 * Each hand holds the opposite cable, so the cables cross in front of the chest like the catalog's "X".
 */
const MACHINE_POS: Vec3 = [0.048, 0, 1.45];
const SHEAVE_RADIUS = 0.07;
const SHEAVE: Record<Side, Vector3> = {
  L: new Vector3(0.705, 1.897, 0.87),
  R: new Vector3(-0.705, 1.897, 0.87),
};
const other = (side: Side): Side => (side === "L" ? "R" : "L");

const START_HAND: Record<Side, Vector3> = {
  L: new Vector3(-0.06, 1.64, 0.58),
  R: new Vector3(0.06, 1.58, 0.51),
};
/** Upper arms point straight ahead at the start; the X comes from the bent elbows turning the forearms in. */
const START_ELBOW: Record<Side, Vector3> = {
  L: new Vector3(0.28, 1.53, 0.31),
  R: new Vector3(-0.31, 1.52, 0.3),
};
const END_HAND: Record<Side, Vector3> = {
  L: new Vector3(0.68, 1.17, -0.13),
  R: new Vector3(-0.68, 1.17, -0.13),
};

/**
 * The muscle model reads an upper arm that points across the midline above shoulder height as a side delt
 * stretched past its end range, so the elbows stay outside the shoulders and the bent forearms make the X.
 */
function upperArmsOutside(body: Body, side: Side, minLateral = 0.035, weight = 40): Goal {
  const s = sideSign(side);
  const sh = body.index[`shoulder_${side}`];
  const el = body.index[`elbow_${side}`];
  return ({ frame, push }) => {
    const lateral = s * (frame.pos[el].x - frame.pos[sh].x);
    push(weight * Math.min(0, lateral - minLateral));
  };
}

const STANCE = {
  ...POSTURE_HINTS.standing,
  "knee.flex": 8,
  "hip.flex": 5,
  "lumbar.flex": 0,
  "thoracic.flex": -2,
  "neck.flex": -2,
};

/** The cable leaves the sheave rim on the side facing the handle (the swivel pulley turns to the cable). */
function cableExit(side: Side, handleTop: Vector3) {
  const c = SHEAVE[other(side)];
  return c.clone().addScaledVector(handleTop.clone().sub(c).normalize(), SHEAVE_RADIUS);
}

/** D-handle at the grip, its apex turned toward the cable it hangs from. */
function handleState(body: Body, frame: Parameters<typeof propAtGrip>[1], side: Side): PropState {
  const base = propAtGrip(body, frame, side, "grip");
  const pos = new Vector3(...base.pos);
  const gripAxis = new Vector3(1, 0, 0).applyQuaternion({
    x: base.quat[0],
    y: base.quat[1],
    z: base.quat[2],
    w: base.quat[3],
  } as never);
  const toPulley = SHEAVE[other(side)].clone().sub(pos).normalize();
  return { pos: base.pos, quat: quatFromAxisX(gripAxis, toPulley) };
}

function handleTop(state: PropState) {
  const q = { x: state.quat[0], y: state.quat[1], z: state.quat[2], w: state.quat[3] };
  return new Vector3(...state.pos).add(new Vector3(0, 0.1, 0).applyQuaternion(q as never));
}

function cablesClearBody(): FormCheck {
  return {
    id: "cables-clear",
    label: "Crossed cables run clear of the body",
    cue: "When you set up appropriately, the angle of resistance from the cables will naturally guide your arms through the intended diagonal crossing path.",
    evaluate: (context) => {
      const caps = newCapsules(context.body);
      const tethers = context.sequence.tetherStates ?? [];
      return everyFrame(
        context,
        (frame, _a, i) => {
          capsulesInWorld(context.body, frame, caps);
          let worst = 0;
          for (const t of tethers[i] ?? []) {
            const a = new Vector3(...t.points[0]);
            const b = new Vector3(...t.points[t.points.length - 1]);
            const shortened = b.clone().sub(a).multiplyScalar(0.9).add(a);
            context.body.colliders.forEach((col, k) => {
              if (/hand|forearm/.test(col.id)) return;
              const { distance } = closestSegments(a, shortened, caps.a[k], caps.b[k]);
              worst = Math.max(worst, Math.max(col.ra, col.rb) - distance);
            });
          }
          return worst * 1000;
        },
        0,
        " mm of cable inside the body",
      );
    },
  };
}

const base = buildExerciseSpec({
  id: "45-deg-cable-rear-delt-fly-opus",
  catalogId: "2a15c6f170d88066b38fd65f8757716f",
  name: "45° Cable Rear Delt Fly (opus)",
  defaultLoadKg: 5,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  grip: "hang",
  phaseLabels: ["Sweep", "Low", "Return", "High cross"],
  tempo: { lower: 1.5, bottom: 0.3, raise: 1.6, top: 0.3 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8, heelZ: -0.02, balanceZ: false },
  apparatus: { kind: "cable-dual", pulleyY: 1.897, halfWidth: 0.785, z: 0.87, attachment: "d-handle", anchor: "grip" },
  stiffness: { elbow: 5, shoulder: 1.2, lumbar: 10, thoracic: 8, neck: 4, knee: 4, hip: 4 },
  hints: {
    start: {
      ...STANCE,
      "shoulder_L.elev": 104,
      "shoulder_L.plane": 86,
      "shoulder_R.elev": 98,
      "shoulder_R.plane": 86,
      "shoulder.twist": 40,
      "elbow.flex": 36,
      "forearm.pron": 30,
      "wrist.flex": 0,
      "clavicle.elev": 12,
      "clavicle.prot": 12,
    },
    end: {
      ...STANCE,
      "shoulder.elev": 64,
      "shoulder.plane": -14,
      "shoulder.twist": 2,
      "elbow.flex": 14,
      "forearm.pron": 30,
      "wrist.flex": 0,
      "clavicle.elev": 4,
      "clavicle.prot": -14,
    },
  },
  progress: (body, frame) => {
    const hand = anchorPoint(body, frame, "grip_L");
    const shoulder = anchorPoint(body, frame, "shoulderTop_L");
    return Math.atan2(hand.x - shoulder.x, hand.z - shoulder.z);
  },
  extraGoals: (body) => [
    ...SIDES.map((side) => upperArmsOutside(body, side)),
    lockTorsoPitch(body, -3, 30),
    pin(body, "sacrum", () => new Vector3(0, 0, -0.075), 30, "xz"),
  ],
  extraKeyGoals: (body) => ({
    start: SIDES.flatMap((side) => [
      pin(body, `grip_${side}`, () => START_HAND[side], 30),
      pin(body, `elbowTip_${side}`, () => START_ELBOW[side], 24),
    ]),
    end: SIDES.map((side) => pin(body, `grip_${side}`, () => END_HAND[side], 30)),
  }),
  checks: () => [
    checkFlatBack("Keep your torso upright with your chest up throughout the set, while all the motion occurs from your arms moving at your shoulder joints."),
    checkJointWithinAt(
      "hands-high",
      "Arms crossed with the hands above shoulder height",
      "Your arms should resemble an “X-shape” with each other as your hands are above shoulder height in line with the resistance from the cables.",
      "shoulder_L.elev",
      "start",
      90,
      130,
    ),
    checkJointWithinAt(
      "soft-elbows",
      "Elbows stay slightly bent",
      "Maintain slightly bent elbows throughout your set.",
      "elbow_L.flex",
      "peak",
      6,
      35,
    ),
    checkJointWithinAt(
      "elbows-back",
      "Elbows finish level with or behind the shoulders",
      "Your elbows being slightly behind your shoulders or at least horizontally level with your shoulders at the end range.",
      "shoulder_L.plane",
      "peak",
      -40,
      5,
    ),
    checkJointRange(
      "diagonal-down",
      "Arms sweep down as much as out",
      "Strive to achieve a roughly even balance between sweeping horizontally outward and vertically downward.",
      "shoulder_L.elev",
      30,
    ),
    cablesClearBody(),
  ],
});

export const spec: ExerciseSpec = {
  ...base,
  laterality: "bilateral",
  build(body: Body): Built {
    const built = base.build(body);
    const handleIdx = SIDES.map((side) => built.props.findIndex((p) => p.id === `handle_${side}`));
    return {
      ...built,
      laterality: "bilateral",
      loads: built.loads.map((load) => {
        const side = SIDES.find((s) => load.anchor === `grip_${s}`);
        return side ? { ...load, pulley: SHEAVE[other(side)].toArray() as Vec3 } : load;
      }),
      propState: (frame, extras) => {
        const states = built.propState(frame, extras);
        SIDES.forEach((side, i) => (states[handleIdx[i]] = handleState(body, frame, side)));
        return states;
      },
      tetherState: (_frame, _extras, propStates) =>
        SIDES.map((side, i) => {
          const top = handleTop(propStates[handleIdx[i]]);
          return { points: [cableExit(side, top).toArray() as Vec3, top.toArray() as Vec3] };
        }),
      glb: [{ id: "dualadjustablepulley-opus", pos: MACHINE_POS, hideEquipment: true }],
      cameraHint: { view: "Angle" },
    };
  },
};
