import { Matrix4, Quaternion, Vector3 } from "three";
import { anchorPoint, GRIP_RADIUS, sideSign, worldPoint, type Body, type Frame, type Side } from "./body";
import type { HandGrip, HandGripConfig, HandleSpec, PerHandGrip } from "./contracts";
import type { PropDef, PropState } from "./equipment";
import type { Goal } from "./solver";

/**
 * One hand holding one handle for the whole rep. The handle is the single source for where the fingers close, how
 * wide they open (its radius) and what QA measures the hand against, so the rendered grip can't drift off the object.
 */
export interface Grasp {
  side: Side;
  /** Prop whose frame `handle` is given in (it moves with the prop); omitted for a handle fixed in the world. */
  prop?: string;
  handle: HandleSpec;
  grip: HandGrip;
  /** True when `handle.palmNormal` is a real facing (a machine handle); a free bar or dumbbell rolls in the hand. */
  orient?: boolean;
}

/** Grips that close the fingers around something, so the hand needs a grasp to close on. */
export const CLOSING_GRIPS = new Set<HandGrip>(["bar", "hang", "press", "neutral", "hook", "ball-stop", "pinch"]);
/** Grips whose fingers wrap a cylinder centred on the hand's grip anchor, running along the wrist's Z axis. */
export const CYLINDER_GRIPS = new Set<HandGrip>(["bar", "hang", "press", "neutral", "hook"]);

export function graspProp(side: Side, prop: string, handle: HandleSpec, grip: HandGrip = handle.grip): Grasp {
  return { side, prop, handle, grip };
}

export function graspWorld(side: Side, handle: HandleSpec, grip: HandGrip = handle.grip): Grasp {
  return { side, handle, grip, orient: true };
}

/**
 * Which way the thumb points along a shaft for a grip style: overhand turns the thumbs toward each other, underhand
 * away from each other, neutral toward the shaft's forward or upward end.
 */
export function thumbAlong(axis: Vector3, style: "overhand" | "underhand" | "neutral", side: Side, out = new Vector3()) {
  out.copy(axis).normalize();
  if (style === "neutral") return out.dot(new Vector3(0, 0.6, 1)) < 0 ? out.negate() : out;
  if (out.x < 0) out.negate();
  return out.multiplyScalar(style === "overhand" ? -sideSign(side) : sideSign(side));
}

export const gripAnchor = (grip: HandGrip, side: Side) => `${grip === "press" ? "press" : "grip"}_${side}`;

const palmOut = new Vector3();
/** Where the axis of a handle of `radius` sits in a closed hand: the grip anchor, pushed out of the palm for thick handles. */
export function gripCenter(body: Body, frame: Frame, side: Side, grip: HandGrip, radius: number, out = new Vector3()) {
  const { joint, local } = body.anchors[gripAnchor(grip, side)];
  worldPoint(frame, joint, local, out);
  palmOut.set(-sideSign(side), 0, 0).applyQuaternion(frame.rot[body.index[`wrist_${side}`]]);
  return out.addScaledVector(palmOut, radius - GRIP_RADIUS);
}

export interface WorldHandle {
  pos: Vector3;
  axis: Vector3;
  palmNormal: Vector3;
}

/** A prop handle in world space, through the same offset/rotation/scale the renderer applies to the prop's GLB. */
export function propHandleWorld(prop: PropDef, state: PropState, handle: HandleSpec): WorldHandle {
  const rot = new Quaternion(...state.quat);
  const inner = prop.kind === "glb" && prop.quat ? new Quaternion(...prop.quat) : new Quaternion();
  const scale = prop.kind === "glb" ? (prop.scale ?? 1) : 1;
  const offset = prop.kind === "glb" && prop.offset ? new Vector3(...prop.offset) : new Vector3();
  const local = (v: readonly number[]) => new Vector3(v[0], v[1], v[2]);
  const pos = local(handle.pos).multiplyScalar(scale).applyQuaternion(inner).add(offset).applyQuaternion(rot).add(new Vector3(...state.pos));
  const turn = inner.clone().premultiply(rot);
  return {
    pos,
    axis: local(handle.axis).applyQuaternion(turn).normalize(),
    palmNormal: local(handle.palmNormal).applyQuaternion(turn).normalize(),
  };
}

export function worldHandle(handle: HandleSpec): WorldHandle {
  return {
    pos: new Vector3(...handle.pos),
    axis: new Vector3(...handle.axis).normalize(),
    palmNormal: new Vector3(...handle.palmNormal).normalize(),
  };
}

/** Resolves a grasp's handle for one frame from the props and their states. */
export function graspHandleAt(grasp: Grasp, props: PropDef[], states: PropState[]): WorldHandle {
  if (!grasp.prop) return worldHandle(grasp.handle);
  const i = props.findIndex((p) => p.id === grasp.prop);
  if (i < 0) throw new Error(`grasp ${grasp.side}: unknown prop "${grasp.prop}"`);
  return propHandleWorld(props[i], states[i], grasp.handle);
}

const handleInPropFrame = (prop: PropDef, handle: HandleSpec) =>
  propHandleWorld(prop, { pos: [0, 0, 0], quat: [0, 0, 0, 1] }, handle);

const basis = (x: Vector3, up: Vector3) => {
  const ax = x.clone().normalize();
  const ay = up.clone().addScaledVector(ax, -up.dot(ax));
  if (ay.lengthSq() < 1e-8) ay.set(0, 1, 0).addScaledVector(ax, -ax.y);
  ay.normalize();
  return new Matrix4().makeBasis(ax, ay, ax.clone().cross(ay));
};

/**
 * Where a hand-carried prop sits for this frame so each grasped handle lies exactly in its closed hand: one hand sets the
 * prop's whole pose (a dumbbell), two hands set it from their grip centres and their mean palm direction (a barbell, a
 * lat bar's angled ends). Use it as the prop's `propState`; the prop then can't drift out of the fingers.
 */
export function carryProp(body: Body, frame: Frame, prop: PropDef, grasps: Grasp[]): PropState {
  const held = grasps.filter((g) => g.prop === prop.id);
  if (held.length === 0 || held.length > 2) throw new Error(`carryProp ${prop.id}: needs one or two grasps on it, got ${held.length}`);
  const centres = held.map((g) => gripCenter(body, frame, g.side, g.grip, g.handle.radius));
  const palms = held.map((g) => new Vector3(-sideSign(g.side), 0, 0).applyQuaternion(frame.rot[body.index[`wrist_${g.side}`]]));
  const local = held.map((g) => handleInPropFrame(prop, g.handle));
  let world: Matrix4;
  let inner: Matrix4;
  if (held.length === 1) {
    const shaft = new Vector3(0, 0, 1).applyQuaternion(frame.rot[body.index[`wrist_${held[0].side}`]]);
    world = basis(shaft, palms[0]).setPosition(centres[0]);
    inner = basis(local[0].axis, local[0].palmNormal).setPosition(local[0].pos);
  } else {
    const [a, b] = held[0].side === "L" ? [0, 1] : [1, 0];
    const span = centres[a].distanceTo(centres[b]);
    // One straight handle under both hands: place them symmetrically about its centre, left hand toward +axis.
    const same = held[0].handle === held[1].handle || local[a].pos.distanceTo(local[b].pos) < 1e-6;
    const la = same ? local[a].pos.clone().addScaledVector(local[a].axis, span / 2) : local[a].pos;
    const lb = same ? local[b].pos.clone().addScaledVector(local[b].axis, -span / 2) : local[b].pos;
    const palmWorld = palms[0].clone().add(palms[1]);
    const palmLocal = local[0].palmNormal.clone().add(local[1].palmNormal);
    world = basis(centres[a].clone().sub(centres[b]), palmWorld).setPosition(centres[a].clone().add(centres[b]).multiplyScalar(0.5));
    inner = basis(la.clone().sub(lb), palmLocal).setPosition(la.clone().add(lb).multiplyScalar(0.5));
  }
  const m = world.multiply(inner.invert());
  const pos = new Vector3();
  const quat = new Quaternion();
  m.decompose(pos, quat, new Vector3());
  return { pos: [pos.x, pos.y, pos.z], quat: [quat.x, quat.y, quat.z, quat.w] };
}

/**
 * Keeps two hands on one carried prop as far apart as its two handles are (a lat bar's angled ends, a trap bar), so
 * `carryProp` can seat both exactly.
 */
export function keepGraspSpan(body: Body, a: Grasp, b: Grasp, prop: PropDef, weight = 30): Goal {
  const span = handleInPropFrame(prop, a.handle).pos.distanceTo(handleInPropFrame(prop, b.handle).pos);
  const pa = new Vector3();
  const pb = new Vector3();
  return ({ frame, push }) => {
    gripCenter(body, frame, a.side, a.grip, a.handle.radius, pa);
    gripCenter(body, frame, b.side, b.grip, b.handle.radius, pb);
    push(weight * (pa.distanceTo(pb) - span));
  };
}

/** A moving machine node, as the hidden prop that stands in for it, and where it was when the anchors were read. */
export interface Carrier {
  prop: string;
  bind: PropState;
}

const stateMatrix = (s: PropState, out = new Matrix4()) =>
  out.compose(new Vector3(...s.pos), new Quaternion(...s.quat), new Vector3(1, 1, 1));

/**
 * How far a carrier has moved from its bind state, as a world transform, for a candidate pose: apply it to anything
 * read off the machine (a footplate target) to keep it on the moving part.
 */
export function carried(carrier: Carrier, live: LiveProps): (frame: Frame, q: Float64Array) => Matrix4 {
  const inverseBind = stateMatrix(carrier.bind).invert();
  const out = new Matrix4();
  return (frame, q) => {
    const { props, states } = live(frame, q);
    const i = props.findIndex((p) => p.id === carrier.prop);
    if (i < 0) throw new Error(`carried: no prop "${carrier.prop}"; is the machine driven?`);
    return stateMatrix(states[i], out).multiply(inverseBind);
  };
}

/** Live prop states for a candidate pose, so goals can track equipment that moves with the solve (a sled, a lever). */
export type LiveProps = (frame: Frame, q: Float64Array) => { props: PropDef[]; states: PropState[] };

/**
 * Puts the hand on its grasped handle: the handle's axis through the grip centre, the wrist's Z along the shaft and
 * the palm facing `palmNormal`. A handle on a moving prop is tracked through `live`.
 */
export function holdGrasp(
  body: Body,
  grasp: Grasp,
  live?: LiveProps,
  options: {
    weight?: number;
    align?: number;
    palm?: number;
    wrist?: number;
    /** Where along the handle the hand sits, from its centre toward `axis`; free when omitted on a long bar. */
    at?: number;
    /** Overhand, underhand or neutral: sets which way the thumb points along the shaft. */
    style?: "overhand" | "underhand" | "neutral";
  } = {},
): Goal[] {
  const { weight = 40, align = 6, wrist = 0.6, style } = options;
  const palm = grasp.orient ? (options.palm ?? 3) : 0;
  const thumb = new Vector3();
  const at = options.at ?? (grasp.handle.length < 0.3 ? 0 : undefined);
  if (grasp.prop && !live) throw new Error(`holdGrasp ${grasp.side}: grasp on prop "${grasp.prop}" needs live prop states`);
  const side = grasp.side;
  const s = sideSign(side);
  const j = body.index[`wrist_${side}`];
  const centre = new Vector3();
  const shaft = new Vector3();
  const facing = new Vector3();
  const fixed = grasp.prop ? null : worldHandle(grasp.handle);
  const resolve = (frame: Frame, q: Float64Array) => {
    if (fixed) return fixed;
    const { props, states } = live!(frame, q);
    return graspHandleAt(grasp, props, states);
  };
  return [
    ({ frame, q, push }) => {
      const h = resolve(frame, q);
      gripCenter(body, frame, side, grasp.grip, grasp.handle.radius, centre).sub(h.pos);
      const along = centre.dot(h.axis);
      centre.addScaledVector(h.axis, -along);
      push(weight * centre.x);
      push(weight * centre.y);
      push(weight * centre.z);
      push(at === undefined ? 0 : weight * 0.5 * (along - at));
    },
    ({ frame, q, push }) => {
      const h = resolve(frame, q);
      shaft.set(0, 0, 1).applyQuaternion(frame.rot[j]);
      if (style) {
        thumbAlong(h.axis, style, side, thumb);
        push(align * (shaft.x - thumb.x));
        push(align * (shaft.y - thumb.y));
        push(align * (shaft.z - thumb.z));
      } else {
        const c = shaft.cross(h.axis);
        push(align * c.x);
        push(align * c.y);
        push(align * c.z);
      }
      facing.set(-s, 0, 0).applyQuaternion(frame.rot[j]);
      push(palm * (facing.x - h.palmNormal.x));
      push(palm * (facing.y - h.palmNormal.y));
      push(palm * (facing.z - h.palmNormal.z));
    },
    ({ angles: a, push }) => {
      push(wrist * a[`wrist_${side}.flex`]);
      push(wrist * a[`wrist_${side}.dev`]);
    },
  ];
}

/**
 * The finger pose for each hand: the grasped handle's grip and radius, or the author's grip for a free hand. Throws on
 * a closed hand that holds nothing, or a grasped hand given a different grip than its grasp.
 */
export function resolveGrips(id: string, grasps: Grasp[], authored?: HandGripConfig): PerHandGrip {
  const sides: Side[] = ["L", "R"];
  const authoredFor = (side: Side): HandGrip | undefined =>
    authored === undefined ? undefined : typeof authored === "string" ? authored : authored[side];
  const out = { L: "relaxed", R: "relaxed" } as PerHandGrip;
  for (const side of sides) {
    const held = grasps.filter((g) => g.side === side);
    if (held.length > 1) throw new Error(`${id}: hand ${side} has ${held.length} grasps; one hand holds one handle`);
    const want = authoredFor(side);
    const grasp = held[0];
    if (grasp) {
      if (want && want !== grasp.grip) {
        throw new Error(`${id}: hand ${side} grips "${want}" but its grasp uses "${grasp.grip}"; set the grip on the grasp`);
      }
      out[side] = grasp.grip;
      out[side === "L" ? "radiusL" : "radiusR"] = grasp.handle.radius;
    } else if (want) {
      if (CLOSING_GRIPS.has(want)) {
        throw new Error(
          `${id}: hand ${side} closes into "${want}" around nothing; declare what it holds with a grasp (machine.grasp / graspProp)`,
        );
      }
      out[side] = want;
    }
  }
  return out;
}

/** Shared by QA: the hand anchor a contact report names for a grasp. */
export function graspAnchorPoint(body: Body, frame: Frame, grasp: Grasp) {
  return anchorPoint(body, frame, gripAnchor(grasp.grip, grasp.side));
}
