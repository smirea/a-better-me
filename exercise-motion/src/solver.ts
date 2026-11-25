import { Matrix4, Vector3 } from "three";
import {
  angles,
  BALL_LIMITS,
  fk,
  newFrame,
  shoulderElevationLimit,
  sideSign,
  worldPoint,
  type Angles,
  type Body,
  type Frame,
  type Side,
} from "./body";
import { signedDistance, type Shape } from "./equipment";
import type { PadSurface } from "./equipment";
import { closestSegments, deg, rad, solveCholesky } from "./math";

export interface GoalContext {
  body: Body;
  /** Body degrees of freedom first, then any extra unknowns the caller appended (a bar's free height, say). */
  q: Float64Array;
  frame: Frame;
  angles: Angles;
  push: (residual: number) => void;
}

/** Appends weighted residuals. It must push the same number of them on every call. */
export type Goal = (context: GoalContext) => void;

export interface Obstacle {
  shape: Shape;
  /** Collider ids allowed to touch this part, and how deep each may press in metres. */
  allow: Record<string, number>;
}

export interface SolveOptions {
  goals: Goal[];
  prior: ArrayLike<number>;
  priorWeights: ArrayLike<number>;
  selfPairs: [number, number, number][];
  obstacles?: Obstacle[];
  /** Equipment that moves with the pose (carried weights, a driven sled or lever), placed for each candidate pose. */
  movingObstacles?: (frame: Frame, q: Float64Array) => Obstacle[];
  iterations?: number;
}

export interface Solution {
  q: Float64Array;
  cost: number;
  iterations: number;
}

const LIMIT_WEIGHT = 25;
const COLLISION_WEIGHT = 40;
const COLLISION_MARGIN = 0.004;
const SAMPLES = 5;

const over = (value: number, lo: number, hi: number) =>
  value > hi ? value - hi : value < lo ? value - lo : 0;

export function limitViolations(
  body: Body,
  q: ArrayLike<number>,
  a: Angles,
  visit: (key: string, excess: number) => void,
) {
  jointRanges(body, q, a, (key, value, lo, hi) => visit(key, over(value, lo, hi)));
}

/** Every limited motion with its current value and range, in radians: the joint limits as the solver enforces them. */
export function jointRanges(
  body: Body,
  q: ArrayLike<number>,
  a: Angles,
  visit: (key: string, value: number, lo: number, hi: number) => void,
) {
  for (const joint of body.joints) {
    if (joint.kind === "hinge" || joint.kind === "universal") {
      joint.dofs.forEach((dof, n) =>
        visit(`${joint.name}.${dof.name}`, q[joint.dofStart + n], dof.limit[0], dof.limit[1]),
      );
      continue;
    }
    if (joint.kind === "root") continue;
    const base = joint.side ? joint.name.slice(0, -2) : joint.name;
    for (const motion of base === "hip"
      ? ["flex", "abd", "rot"]
      : base === "shoulder"
        ? ["twist"]
        : ["flex", "bend", "twist"]) {
      const range = BALL_LIMITS[`${base}.${motion}`];
      visit(`${joint.name}.${motion}`, a[`${joint.name}.${motion}`], rad(range[0]), rad(range[1]));
    }
    if (base === "shoulder") {
      const elevation = a[`${joint.name}.elev`];
      // The plane is undefined for a hanging arm, so the limit only applies once the arm has lifted.
      const max =
        elevation < rad(20) ? Math.PI : rad(shoulderElevationLimit(deg(a[`${joint.name}.plane`])));
      visit(`${joint.name}.elev`, elevation, -Math.PI, max);
    }
  }
}

export interface CapsuleWorld {
  a: Vector3[];
  b: Vector3[];
}

export const newCapsules = (body: Body): CapsuleWorld => ({
  a: body.colliders.map(() => new Vector3()),
  b: body.colliders.map(() => new Vector3()),
});

export function capsulesInWorld(body: Body, frame: Frame, out: CapsuleWorld) {
  body.colliders.forEach((collider, i) => {
    worldPoint(frame, collider.joint, collider.a, out.a[i]);
    worldPoint(frame, collider.joint, collider.b, out.b[i]);
  });
  return out;
}

/** How far two of the body's capsules overlap, positive when they intersect. */
export function capsulePenetration(body: Body, capsules: CapsuleWorld, i: number, j: number) {
  const hit = closestSegments(capsules.a[i], capsules.b[i], capsules.a[j], capsules.b[j]);
  const ci = body.colliders[i];
  const cj = body.colliders[j];
  return ci.ra + (ci.rb - ci.ra) * hit.s + cj.ra + (cj.rb - cj.ra) * hit.t - hit.distance;
}

const sample = new Vector3();
const mid = new Vector3();

/** How deep a body capsule sits inside an equipment part, positive when they intersect. */
export function obstaclePenetration(body: Body, capsules: CapsuleWorld, i: number, shape: Shape) {
  const collider = body.colliders[i];
  const a = capsules.a[i];
  const b = capsules.b[i];
  mid.addVectors(a, b).multiplyScalar(0.5);
  const reach = a.distanceTo(b) / 2 + Math.max(collider.ra, collider.rb) + shape.bound;
  if (mid.distanceToSquared(shape.pos) > reach * reach) return -1;
  let worst = -Infinity;
  for (let n = 0; n < SAMPLES; n++) {
    const t = n / (SAMPLES - 1);
    sample.lerpVectors(a, b, t);
    worst = Math.max(
      worst,
      collider.ra + (collider.rb - collider.ra) * t - signedDistance(shape, sample),
    );
  }
  return worst;
}

/**
 * Finds the pose nearest the prior that meets the goals, stays inside every joint's range of motion, and keeps
 * the body out of itself and the equipment, by Levenberg-Marquardt over a finite-difference Jacobian.
 */
export function solve(body: Body, start: ArrayLike<number>, options: SolveOptions): Solution {
  const n = start.length;
  const q = Float64Array.from(start);
  const frame = newFrame(body);
  const capsules = newCapsules(body);
  const anglesOut: Angles = {};
  let residuals: number[] = [];
  const context: GoalContext = {
    body,
    q,
    frame,
    angles: anglesOut,
    push: (value) => residuals.push(value),
  };

  const evaluate = (at: Float64Array) => {
    residuals = [];
    context.q = at;
    fk(body, at, frame);
    angles(body, at, anglesOut);
    for (const goal of options.goals) goal(context);
    for (let i = 0; i < n; i++)
      residuals.push(options.priorWeights[i] * (at[i] - options.prior[i]));
    limitViolations(body, at, anglesOut, (_, excess) => residuals.push(LIMIT_WEIGHT * excess));
    capsulesInWorld(body, frame, capsules);
    for (const [i, j, tolerance] of options.selfPairs) {
      const depth = capsulePenetration(body, capsules, i, j) - tolerance + COLLISION_MARGIN;
      residuals.push(COLLISION_WEIGHT * Math.max(0, depth));
    }
    const moving = options.movingObstacles?.(frame, at) ?? [];
    for (const obstacle of moving.length ? [...(options.obstacles ?? []), ...moving] : (options.obstacles ?? [])) {
      for (let i = 0; i < body.colliders.length; i++) {
        const collider = body.colliders[i];
        const allowed = obstacle.allow[collider.id] ?? (collider.contactAs ? obstacle.allow[collider.contactAs] : undefined) ?? 0;
        const depth =
          obstaclePenetration(body, capsules, i, obstacle.shape) - allowed + COLLISION_MARGIN;
        residuals.push(COLLISION_WEIGHT * Math.max(0, depth));
      }
    }
    return residuals;
  };

  const sumSquares = (r: number[]) => {
    let sum = 0;
    for (const value of r) sum += value * value;
    return sum;
  };

  let r = evaluate(q);
  let cost = sumSquares(r);
  let lambda = 1e-2;
  const step = 1e-6;
  const trial = new Float64Array(n);
  const maxIterations = options.iterations ?? 60;
  let iteration = 0;
  for (; iteration < maxIterations; iteration++) {
    const m = r.length;
    const J = new Float64Array(m * n);
    for (let j = 0; j < n; j++) {
      trial.set(q);
      trial[j] += step;
      const rj = evaluate(trial);
      for (let i = 0; i < m; i++) J[i * n + j] = (rj[i] - r[i]) / step;
    }
    const JtJ = new Float64Array(n * n);
    const g = new Float64Array(n);
    for (let i = 0; i < m; i++) {
      const row = i * n;
      for (let a = 0; a < n; a++) {
        const ja = J[row + a];
        if (ja === 0) continue;
        g[a] += ja * r[i];
        for (let b = a; b < n; b++) JtJ[a * n + b] += ja * J[row + b];
      }
    }
    for (let a = 0; a < n; a++) for (let b = 0; b < a; b++) JtJ[a * n + b] = JtJ[b * n + a];

    let improved = false;
    let largest = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const A = Float64Array.from(JtJ);
      const delta = Float64Array.from(g, (value) => -value);
      for (let a = 0; a < n; a++) A[a * n + a] += lambda * (JtJ[a * n + a] + 1e-6);
      if (!solveCholesky(A, delta, n)) {
        lambda *= 10;
        continue;
      }
      for (let a = 0; a < n; a++) trial[a] = q[a] + delta[a];
      const next = evaluate(trial);
      const nextCost = sumSquares(next);
      if (nextCost < cost) {
        largest = 0;
        for (let a = 0; a < n; a++) largest = Math.max(largest, Math.abs(delta[a]));
        q.set(trial);
        const gain = cost - nextCost;
        r = next;
        cost = nextCost;
        lambda = Math.max(lambda / 3, 1e-7);
        improved = gain > 1e-12 * (1 + cost);
        break;
      }
      lambda *= 4;
    }
    if (!improved || largest < 1e-6) break;
  }
  return { q, cost, iterations: iteration };
}

const point = new Vector3();

/** Holds a body anchor at a world position, on the axes named in `axes`. */
export function pin(
  body: Body,
  anchor: string,
  target: (q: Float64Array, frame: Frame) => Vector3,
  weight: number,
  axes = "xyz",
): Goal {
  const { joint, local } = body.anchors[anchor] ?? {
    joint: body.index[anchor],
    local: new Vector3(),
  };
  if (joint === undefined) throw new Error(`Unknown anchor or joint ${anchor}`);
  return ({ frame, q, push }) => {
    worldPoint(frame, joint, local, point);
    const t = target(q, frame);
    if (axes.includes("x")) push(weight * (point.x - t.x));
    if (axes.includes("y")) push(weight * (point.y - t.y));
    if (axes.includes("z")) push(weight * (point.z - t.z));
  };
}

const direction = new Vector3();

/** Points a joint's local direction along a world direction. */
export function aim(
  body: Body,
  jointName: string,
  local: Vector3,
  world: Vector3,
  weight: number,
): Goal {
  const joint = body.index[jointName];
  return ({ frame, push }) => {
    direction.copy(local).applyQuaternion(frame.rot[joint]);
    push(weight * (direction.x - world.x));
    push(weight * (direction.y - world.y));
    push(weight * (direction.z - world.z));
  };
}

/** A horizontal surface at a height, or a tilted pad such as a leg press footplate. */
export type Surface = PadSurface | number;

interface SurfaceFrame {
  origin: Vector3;
  /** Out of the surface, toward the body resting on it. */
  normal: Vector3;
  /** The way a foot or hand points at zero yaw: +Z on a floor, up the pad on a footplate. */
  forward: Vector3;
}

function surfaceFrame(surface: Surface): SurfaceFrame {
  if (typeof surface === "number")
    return { origin: new Vector3(0, surface, 0), normal: new Vector3(0, 1, 0), forward: new Vector3(0, 0, 1) };
  const normal = new Vector3(...surface.normal).normalize();
  const forward = new Vector3(...surface.up);
  forward.addScaledVector(normal, -forward.dot(normal)).normalize();
  return { origin: new Vector3(...surface.origin), normal, forward };
}

const onSurface = (frame: SurfaceFrame, p: Vector3) =>
  p.clone().addScaledVector(frame.normal, -p.clone().sub(frame.origin).dot(frame.normal));

/** Where an anchor sits in its foot's ankle frame at rest, even one carried by the toes. */
function ankleLocal(body: Body, anchor: string) {
  const { joint, local } = body.anchors[anchor];
  const p = local.clone();
  for (let j = joint; body.joints[j].name.startsWith("toes"); j = body.joints[j].parent) p.add(body.joints[j].offset);
  return p;
}

/**
 * Targets on a surface for foot anchors at their rest layout around a reference anchor, the foot turned out by `yaw`
 * (positive toward the foot's own side on both feet) and pressed `sink` into the surface.
 */
function footLayout(body: Body, side: Side, frame: SurfaceFrame, at: Vector3, reference: Vector3, yaw: number, sink: number) {
  const s = sideSign(side);
  const forward = frame.forward.clone().applyAxisAngle(frame.normal, s * yaw);
  const lateral = frame.normal.clone().cross(forward);
  const base = onSurface(frame, at);
  return (anchor: string) => {
    const rel = ankleLocal(body, anchor).sub(reference);
    return base
      .clone()
      .addScaledVector(lateral, rel.x)
      .addScaledVector(frame.normal, rel.y - sink)
      .addScaledVector(forward, rel.z);
  };
}

/** Keeps an anchor at or above a surface, as a one-sided constraint. */
function aboveSurface(
  body: Body,
  anchor: string,
  frame: SurfaceFrame,
  weight: number,
  carry?: (frame: Frame, q: Float64Array) => Matrix4,
): Goal {
  const { joint, local } = body.anchors[anchor];
  const p = new Vector3();
  const back = new Matrix4();
  return ({ frame: pose, q, push }) => {
    worldPoint(pose, joint, local, p);
    if (carry) p.applyMatrix4(back.copy(carry(pose, q)).invert());
    push(weight * Math.min(0, p.sub(frame.origin).dot(frame.normal)));
  };
}

/**
 * Plants a foot flat on a floor or a tilted footplate: heel, both sides of the ball, and the toe pads at their rest
 * layout, so the toes stay at neutral. `heel` is where the heel lands; `yaw` turns the toes out.
 */
export function plantFootFlat(
  body: Body,
  side: Side,
  surface: Surface,
  heel: Vector3,
  yaw = 0,
  weight = 40,
  sink = 0,
  /** Moves the planted targets with a moving footplate: `carried(machine.carrier("sled")!, ctx.live)`. */
  carry?: (frame: Frame, q: Float64Array) => Matrix4,
): Goal[] {
  const frame = surfaceFrame(surface);
  const target = footLayout(body, side, frame, heel, ankleLocal(body, `heel_${side}`), yaw, sink);
  const moved = new Vector3();
  return ["heel", "ballIn", "ballOut", "toe"].map((name) => {
    const world = target(`${name}_${side}`);
    return pin(
      body,
      `${name}_${side}`,
      carry ? (q, pose) => moved.copy(world).applyMatrix4(carry(pose, q)) : () => world,
      weight,
    );
  });
}

/**
 * Stands a foot on its toe break, for push-ups, planks, lunges, split squats and calf raises: the toes lie flat with
 * the forefoot at `ball`, and the heel is free to rise as the toes extend at the metatarsal heads. The toe joint
 * holds its rest height over the surface, since the metatarsal heads roll rather than pivot on one patch of sole, and
 * the hindfoot's ball and heel only have to stay out of the surface.
 */
export function plantFootOnToeBreak(
  body: Body,
  side: Side,
  surface: Surface,
  ball: Vector3,
  yaw = 0,
  options: { weight?: number; sink?: number; carry?: (frame: Frame, q: Float64Array) => Matrix4 } = {},
): Goal[] {
  const { weight = 40, sink = 0, carry } = options;
  const frame = surfaceFrame(surface);
  const forefoot = ankleLocal(body, `forefoot_${side}`);
  const target = footLayout(body, side, frame, ball, forefoot, yaw, sink);
  const moved = new Vector3();
  const goals = ["forefoot", "toe", "toeTip"].map((name) => {
    const world = target(`${name}_${side}`);
    return pin(body, `${name}_${side}`, carry ? (q, pose) => moved.copy(world).applyMatrix4(carry(pose, q)) : () => world, weight);
  });
  for (const name of ["heel", "ballIn", "ballOut"]) goals.push(aboveSurface(body, `${name}_${side}`, frame, weight, carry));
  return goals;
}

/**
 * Stands the ball of a foot on a step's edge for calf raises: the sole under the metatarsal heads on the edge line,
 * level across, with the toes flat on the step top and the heel free to drop below the edge. `edge` is a point on
 * the edge where the ball goes, `normal` the step top's upward normal, `inward` the way from the edge onto the step.
 */
export function plantFootOnEdge(
  body: Body,
  side: Side,
  edge: Vector3,
  normal: Vector3,
  inward: Vector3,
  yaw = 0,
  options: { weight?: number } = {},
): Goal[] {
  const { weight = 40 } = options;
  const n = normal.clone().normalize();
  const along = inward.clone().addScaledVector(n, -inward.dot(n)).normalize();
  const frame: SurfaceFrame = { origin: edge.clone(), normal: n, forward: along };
  const ballIn = body.anchors[`ballIn_${side}`];
  const ballOut = body.anchors[`ballOut_${side}`];
  const a = new Vector3();
  const b = new Vector3();
  const mid = new Vector3();
  const lateral = n.clone().cross(along.clone().applyAxisAngle(n, sideSign(side) * yaw));
  const ballEdge: Goal = ({ frame: pose, push }) => {
    worldPoint(pose, ballIn.joint, ballIn.local, a);
    worldPoint(pose, ballOut.joint, ballOut.local, b);
    mid.addVectors(a, b).multiplyScalar(0.5).sub(edge);
    push(weight * mid.dot(n));
    push(weight * mid.dot(along));
    push(weight * mid.dot(lateral));
    push(weight * 0.5 * a.sub(b).dot(n));
  };
  const reference = ankleLocal(body, `ballIn_${side}`).add(ankleLocal(body, `ballOut_${side}`)).multiplyScalar(0.5);
  const target = footLayout(body, side, frame, edge, reference, yaw, 0);
  const goals: Goal[] = [ballEdge];
  for (const name of ["toe", "toeTip"]) {
    const world = target(`${name}_${side}`);
    goals.push(pin(body, `${name}_${side}`, () => world, weight * 0.6));
  }
  return goals;
}

/** Plants a foot on a horizontal surface by its heel, with the toes neutral. Kept for callers that predate `plantFootFlat`. */
export function plantFoot(body: Body, side: Side, heel: Vector3, toeOut: number, weight = 40): Goal[] {
  return plantFootFlat(body, side, heel.y, heel, toeOut, weight);
}

/** Plants only the forefoot on a horizontal surface, letting the heel lift. Kept for callers that predate `plantFootOnToeBreak`. */
export function plantToe(body: Body, side: Side, ballCenter: Vector3, toeOut = 0, weight = 40): Goal[] {
  return plantFootOnToeBreak(body, side, ballCenter.y, ballCenter, toeOut, { weight });
}

/**
 * Braces a hand flat on a floor, bench or pad, as in a push-up, plank or bench support: the palm's centre at `pos`
 * pressed `sink` into the surface, the pads under the knuckles on it too, the palm facing into it, and the fingers
 * pointing along `fingers`. The wrist extends as far as the forearm's angle asks, about 80° under a push-up.
 */
export function braceHandOnSurface(
  body: Body,
  side: Side,
  surface: Surface,
  pos: Vector3,
  fingers: Vector3,
  weight = 40,
  sink = 0.002,
): Goal[] {
  const s = sideSign(side);
  const frame = surfaceFrame(surface);
  const at = onSurface(frame, pos).addScaledVector(frame.normal, -sink);
  const ahead = fingers.clone().addScaledVector(frame.normal, -fingers.dot(frame.normal)).normalize();
  const j = body.index[`wrist_${side}`];
  const knuckles = body.anchors[`knuckles_${side}`];
  const p = new Vector3();
  const facing = new Vector3();
  const along = new Vector3();
  return [
    pin(body, `palm_${side}`, () => at, weight),
    ({ frame: pose, push }) => {
      worldPoint(pose, knuckles.joint, knuckles.local, p);
      push(weight * (p.sub(frame.origin).dot(frame.normal) + sink));
    },
    ({ frame: pose, push }) => {
      facing.set(-s, 0, 0).applyQuaternion(pose.rot[j]);
      push(weight * 0.25 * (facing.dot(frame.normal) + 1));
      along.set(0, -1, 0).applyQuaternion(pose.rot[j]);
      along.addScaledVector(frame.normal, -along.dot(frame.normal));
      push(weight * 0.15 * along.cross(ahead).dot(frame.normal));
      // The cross term is blind to fingers pointing straight back; this one isn't.
      push(weight * 0.15 * (1 - along.normalize().dot(ahead)));
    },
  ];
}

/** `braceHandOnSurface` on a horizontal floor at the height of `pos`. */
export const palmOnFloor = (body: Body, side: Side, pos: Vector3, fingers: Vector3, weight = 40) =>
  braceHandOnSurface(body, side, pos.y, pos, fingers, weight);

/** Holds an anchor on a tilted pad/plane defined by a surface point `origin` and outward unit `normal`. */
export function restOnPlane(
  body: Body,
  anchor: string,
  origin: Vector3,
  normal: Vector3,
  weight = 35,
  sink = 0.008,
): Goal {
  const { joint, local } = body.anchors[anchor] ?? {
    joint: body.index[anchor],
    local: new Vector3(),
  };
  if (joint === undefined) throw new Error(`Unknown anchor or joint ${anchor}`);
  const n = normal.clone().normalize();
  const p = new Vector3();
  return ({ frame, push }) => {
    worldPoint(frame, joint, local, p);
    const dist = p.sub(origin).dot(n) + sink;
    push(weight * dist);
  };
}

/** Keeps a body anchor at or above a minimum height `minY` (inequality constraint). */
export function keepAbove(body: Body, anchor: string, minY: number, weight = 35): Goal {
  const { joint, local } = body.anchors[anchor] ?? {
    joint: body.index[anchor],
    local: new Vector3(),
  };
  if (joint === undefined) throw new Error(`Unknown anchor or joint ${anchor}`);
  const p = new Vector3();
  return ({ frame, push }) => {
    worldPoint(frame, joint, local, p);
    push(weight * Math.min(0, p.y - minY));
  };
}

/** Holds a named anatomical angle (`hip_L.flex`, `elbow_R.flex`, etc.) at `targetDeg` degrees. */
export function lockAngle(body: Body, angleKey: string, targetDeg: number, weight = 15): Goal {
  const targetRad = rad(targetDeg);
  // Fail fast if the joint portion of angleKey does not exist on the body.
  const jointName = angleKey.split(".")[0];
  if (body.index[jointName] === undefined) throw new Error(`Unknown joint in lockAngle: ${angleKey}`);
  return ({ angles: a, push }) => {
    const val = a[angleKey];
    if (val === undefined) throw new Error(`Unknown angle key in lockAngle: ${angleKey}`);
    push(weight * (val - targetRad));
  };
}

const bend = new Vector3();
const leg = new Vector3();
const foot = new Vector3();
const heelPoint = new Vector3();

/**
 * How far the knee bends off the line its foot points along, in metres, positive toward the outside. A straight
 * leg reads zero whatever the stance width, since only the direction the knee travels in counts.
 */
export function kneeOffFootLine(body: Body, frame: Frame, side: "L" | "R") {
  const hip = frame.pos[body.index[`hip_${side}`]];
  const ankle = frame.pos[body.index[`ankle_${side}`]];
  leg.subVectors(ankle, hip);
  bend.subVectors(frame.pos[body.index[`knee_${side}`]], hip);
  bend.addScaledVector(leg, -bend.dot(leg) / leg.lengthSq());
  const heel = body.anchors[`heel_${side}`];
  const toe = body.anchors[`secondToe_${side}`];
  worldPoint(frame, heel.joint, heel.local, heelPoint);
  worldPoint(frame, toe.joint, toe.local, foot).sub(heelPoint).setY(0).normalize();
  return (side === "L" ? 1 : -1) * (bend.x * foot.z - bend.z * foot.x);
}

export const kneeOverToes =
  (body: Body, side: "L" | "R", weight: number): Goal =>
  ({ frame, push }) =>
    push(weight * kneeOffFootLine(body, frame, side));

const com = new Vector3();
const part = new Vector3();

/**
 * Pulls the combined centre of mass of the lifter and the weight toward a fore-aft position, the way a standing
 * lifter keeps it over the feet. `loads` are the anchors carrying weight, in kilograms each.
 */
export function balance(
  body: Body,
  loads: { anchor: string; kg: number }[],
  z: number,
  weight: number,
): Goal {
  return ({ frame, push }) => {
    com.set(0, 0, 0);
    let mass = 0;
    for (const segment of body.segments) {
      com.addScaledVector(worldPoint(frame, segment.joint, segment.com, part), segment.mass);
      mass += segment.mass;
    }
    for (const load of loads) {
      const anchor = body.anchors[load.anchor];
      com.addScaledVector(worldPoint(frame, anchor.joint, anchor.local, part), load.kg);
      mass += load.kg;
    }
    push(weight * (com.z / mass - z));
  };
}

/**
 * Holds a two-sided lift symmetric: each right joint mirrors its left twin and the spine stays in the midline.
 * Without it the two arms can settle on different answers wherever a pose leaves the elbow free to swivel.
 */
export function mirrored(body: Body, weight: number): Goal {
  const pairs: [number, number, number][] = [];
  const zero: number[] = [0, 4, 5];
  for (const joint of body.joints) {
    if (joint.side === null && joint.kind === "ball")
      zero.push(joint.dofStart + 1, joint.dofStart + 2);
    if (joint.side !== "L") continue;
    const twin = body.joints[body.index[`${joint.name.slice(0, -2)}_R`]];
    if (joint.kind === "ball") {
      pairs.push(
        [joint.dofStart, twin.dofStart, 1],
        [joint.dofStart + 1, twin.dofStart + 1, -1],
        [joint.dofStart + 2, twin.dofStart + 2, -1],
      );
    } else {
      joint.dofs.forEach((_, n) => pairs.push([joint.dofStart + n, twin.dofStart + n, 1]));
    }
  }
  return ({ q, push }) => {
    for (const [left, right, sign] of pairs) push(weight * (q[left] - sign * q[right]));
    for (const index of zero) push(weight * q[index]);
  };
}
