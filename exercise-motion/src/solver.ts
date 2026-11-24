import { Vector3 } from "three";
import {
  angles,
  BALL_LIMITS,
  fk,
  newFrame,
  shoulderElevationLimit,
  worldPoint,
  type Angles,
  type Body,
  type Frame,
} from "./body";
import { signedDistance, type Shape } from "./equipment";
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
  for (const joint of body.joints) {
    if (joint.kind === "hinge" || joint.kind === "universal") {
      joint.dofs.forEach((dof, n) =>
        visit(`${joint.name}.${dof.name}`, over(q[joint.dofStart + n], dof.limit[0], dof.limit[1])),
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
      visit(
        `${joint.name}.${motion}`,
        over(a[`${joint.name}.${motion}`], rad(range[0]), rad(range[1])),
      );
    }
    if (base === "shoulder") {
      const elevation = a[`${joint.name}.elev`];
      // The plane is undefined for a hanging arm, so the limit only applies once the arm has lifted.
      const max =
        elevation < rad(20) ? Math.PI : rad(shoulderElevationLimit(deg(a[`${joint.name}.plane`])));
      visit(`${joint.name}.elev`, Math.max(0, elevation - max));
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
    for (const obstacle of options.obstacles ?? []) {
      for (let i = 0; i < body.colliders.length; i++) {
        const allowed = obstacle.allow[body.colliders[i].id] ?? 0;
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
  target: (q: Float64Array) => Vector3,
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
    const t = target(q);
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

/** Plants a foot: heel and both sides of the ball of the foot held at fixed spots on the floor. */
export function plantFoot(
  body: Body,
  side: "L" | "R",
  heel: Vector3,
  toeOut: number,
  weight = 40,
): Goal[] {
  const s = side === "L" ? 1 : -1;
  const yaw = s * toeOut;
  const spot = (anchor: string) => {
    const local = body.anchors[anchor].local.clone().sub(body.anchors[`heel_${side}`].local);
    const x = local.x * Math.cos(yaw) + local.z * Math.sin(yaw);
    const z = -local.x * Math.sin(yaw) + local.z * Math.cos(yaw);
    const world = new Vector3(heel.x + x, 0, heel.z + z);
    return pin(body, anchor, () => world, weight);
  };
  return [spot(`heel_${side}`), spot(`ballIn_${side}`), spot(`ballOut_${side}`)];
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
