import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  Texture,
  Vector3,
  Vector4,
} from "three";
import { GRIP_RADIUS, PALM_PLANE, sideSign, SIDES, type Body, type Frame, type Side } from "../src/body";
import type { HandGrip, HandGripConfig } from "../src/contracts";
import { clamp, closestSegments, rad, solveCholesky } from "../src/math";
import { MUSCLES } from "../src/muscles";
import { decodeLifter, type FingerBone, type LifterAsset } from "./lifter-asset";

const BODY = new Color("#2e2e2e");
const PLATE = new Color("#4a4a4a");

/** What a hand closes on, in the wrist's own frame: the palm faces -sX, the fingers run down -Y, a bar runs along Z. */
type HandShape =
  | { kind: "cylinder"; center: Vector3; axis: Vector3; radius: number }
  | { kind: "sphere"; center: Vector3; radius: number }
  /** A surface the hand lies on, its normal pointing out of it toward the hand. */
  | { kind: "plane"; point: Vector3; normal: Vector3 }
  /** A bone another finger closes over, such as the thumb under the index and middle fingers of a hook grip. */
  | { kind: "capsule"; a: Vector3; b: Vector3; radius: number }
  | { kind: "union"; shapes: HandShape[] };

/** Default handle radius per grip, in metres: an Olympic shaft, a dumbbell handle, a stopper ball, a plate's half-thickness. */
const GRIP_SIZE: Record<HandGrip, number> = {
  bar: GRIP_RADIUS,
  hang: GRIP_RADIUS,
  press: GRIP_RADIUS,
  hook: GRIP_RADIUS,
  neutral: 0.0155,
  fist: 0.007,
  "ball-stop": 0.022,
  pinch: 0.013,
  open: 0,
  "flat-floor": 0,
  relaxed: 0,
};

/** Each finger's spread from the hand's long axis, in degrees toward the thumb, index to little finger. */
const SPREAD: Partial<Record<HandGrip, number[]>> = {
  "flat-floor": [12, 1, -9, -19],
  open: [6, 0, -5, -11],
};

/** Anatomical flexion, in degrees from straight, of each finger's three joints for the grips that don't close on anything. */
const RELAXED = [
  [22, 30, 14],
  [28, 38, 18],
  [34, 45, 22],
  [40, 52, 26],
];
/** A plate pinch: straight fingers off knuckles bent to hang them down the plate's face. */
const PINCH = [
  [62, 8, 4],
  [64, 8, 4],
  [60, 10, 6],
  [56, 14, 8],
];
/** How far a finger pad gives against a handle before the joint behind it stops closing, in metres. */
const SKIN = 0.0015;
/** How fast each finger joint closes relative to the others, MCP, PIP, DIP: the PIP leads and the DIP follows it. */
const SYNERGY = [1, 1.15, 0.75];
/** The most each finger joint flexes, in degrees from straight: MCP, PIP, DIP. */
const FINGER_FLEXION = [92, 110, 85];
/** The thumb's limits past its rest pose, in degrees: CMC flexion, abduction and axial rotation, then MCP and IP flexion. */
const THUMB_RANGE: [number, number][] = [
  [-35, 65],
  [-45, 45],
  [-30, 75],
  [-15, 70],
  [-20, 85],
];

/** Starting thumb poses past rest, in degrees, as `THUMB_RANGE` orders them: rest, wrapped, opposed, curled. */
const THUMB_STARTS = [
  [0, 0, 0, 0, 0],
  [45, 5, 5, 0, 20],
  [25, -25, 25, 20, 35],
  [55, 10, 30, 15, 45],
];

interface HandBone {
  /** Index into `LifterAsset.fingers`. */
  index: number;
  /** The rest frame in the wrist's frame. */
  position: Vector3;
  rotation: Quaternion;
  /** The rest offset from the parent's joint, in the parent's rest frame, and the rest rotation relative to the parent. */
  offset: Vector3;
  relative: Quaternion;
  bone: FingerBone;
}

/**
 * A vertex of a finger's skin, skinned as the shader skins it, so a grip is judged by the surface that shows, the
 * webs and creases blended between bones included. Influences name the finger's own segments, or -1 for the hand.
 */
interface SkinProbe {
  rest: Vector3;
  center: Vector3;
  influences: { segment: number; weight: number }[];
  /** The finger segment that carries most of it. */
  segment: number;
}

/** How many skin points per finger stand in for its surface when it closes on something. */
const PROBES = 240;

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

/** A finger or thumb bone's pose past rest: flexion about its own X, abduction about its pad (Z), twist about its length. */
const boneRotation = (flex: number, abd = 0, twist = 0, out = new Quaternion()) =>
  out
    .setFromAxisAngle(Z_AXIS, abd)
    .multiply(new Quaternion().setFromAxisAngle(X_AXIS, flex))
    .multiply(new Quaternion().setFromAxisAngle(Y_AXIS, twist));

/** How far a bone's centre line, from `a` to `b`, stays outside a shape's surface: negative once it is inside. */
function clearance(shape: HandShape, a: Vector3, b: Vector3): number {
  if (shape.kind === "union") return Math.min(...shape.shapes.map((part) => clearance(part, a, b)));
  if (shape.kind === "capsule") return closestSegments(a, b, shape.a, shape.b).distance - shape.radius;
  if (shape.kind === "plane") {
    const n = shape.normal;
    return Math.min(a.clone().sub(shape.point).dot(n), b.clone().sub(shape.point).dot(n));
  }
  if (shape.kind === "sphere") {
    return closestSegments(a, b, shape.center, shape.center).distance - shape.radius;
  }
  // A metre of shaft either way stands in for the infinite axis.
  return closestSegments(a, b, shape.center.clone().sub(shape.axis), shape.center.clone().add(shape.axis)).distance - shape.radius;
}

const closestPoint = (a: Vector3, b: Vector3, p: Vector3) => {
  const ab = b.clone().sub(a);
  return a.clone().addScaledVector(ab, clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1));
};

/** The direction from a shape's axis or centre out through a point. */
function outward(shape: HandShape, p: Vector3): Vector3 {
  if (shape.kind === "union") return outward(shape.shapes[0], p);
  if (shape.kind === "capsule") return p.clone().sub(closestPoint(shape.a, shape.b, p)).normalize();
  if (shape.kind === "plane") return shape.normal.clone();
  const d = p.clone().sub(shape.center);
  if (shape.kind === "cylinder") d.addScaledVector(shape.axis, -d.dot(shape.axis));
  return d.normalize();
}

/**
 * Finger and thumb poses for one hand, solved against the shape each grip closes on, tested against the skin the
 * figure actually draws. Fingers close in the flexion synergy until each phalanx meets the bar, ball, or surface, so
 * the wrap follows the handle's radius. The thumb, with three degrees of freedom at its base, is solved to its own
 * target: opposed around the far side of the bar over the fingers, wrapped under them for a hook grip, flat and
 * spread on the floor, pad to pad for a pinch.
 */
export class HandRig {
  readonly bones: Record<Side, HandBone[][]>;
  private readonly skins: Record<Side, SkinProbe[][]> = { L: [], R: [] };
  private readonly wrists: Record<Side, { rotation: Quaternion; translation: Vector3 }>;

  constructor(
    private readonly asset: LifterAsset,
    private readonly body: Body,
  ) {
    this.bones = { L: [], R: [] };
    // The hand's own skin transform with the wrist at the origin of its frame.
    const wristOf = (side: Side) => {
      const bind = asset.bind[body.index[`wrist_${side}`]];
      const rotation = new Quaternion(...bind.rotation).invert();
      return { rotation, translation: new Vector3(...bind.position).applyQuaternion(rotation).negate() };
    };
    this.wrists = { L: wristOf("L"), R: wristOf("R") };
    for (const side of SIDES) {
      const wrist = asset.bind[body.index[`wrist_${side}`]];
      const wristPos = new Vector3(...wrist.position);
      const wristInv = new Quaternion(...wrist.rotation).invert();
      for (let finger = 1; finger <= 5; finger++) {
        const chain: HandBone[] = [];
        for (let segment = 1; segment <= 3; segment++) {
          const index = asset.fingers.findIndex((b) => b.side === side && b.finger === finger && b.segment === segment);
          const bone = asset.fingers[index];
          const position = new Vector3(...bone.position).sub(wristPos).applyQuaternion(wristInv);
          const rotation = wristInv.clone().multiply(new Quaternion(...bone.rotation));
          const parent = chain[segment - 2];
          const parentInv = parent ? parent.rotation.clone().invert() : new Quaternion();
          chain.push({
            index,
            position,
            rotation,
            offset: position.clone().sub(parent?.position ?? new Vector3()).applyQuaternion(parentInv),
            relative: parentInv.multiply(rotation),
            bone,
          });
        }
        this.bones[side].push(chain);
        this.skins[side].push(this.probesOf(chain));
      }
    }
  }

  /** Every vertex a finger's bones carry at least a quarter of, thinned to `PROBES`. */
  private probesOf(chain: HandBone[]) {
    const { positions, centers, skinIndex, skinWeight } = this.asset;
    const segmentOf = new Map(chain.map((b, i) => [this.body.joints.length + b.index, i]));
    const all: SkinProbe[] = [];
    for (let v = 0; v < positions.length / 3; v++) {
      let own = 0;
      let segment = -1;
      let strongest = 0;
      const influences: SkinProbe["influences"] = [];
      for (let k = 0; k < 4; k++) {
        const weight = skinWeight[v * 4 + k] / 255;
        if (weight === 0) continue;
        const s = segmentOf.get(skinIndex[v * 4 + k]) ?? -1;
        influences.push({ segment: s, weight });
        if (s < 0) continue;
        own += weight;
        if (weight > strongest) [strongest, segment] = [weight, s];
      }
      if (own < 0.25) continue;
      all.push({
        rest: new Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]),
        center: new Vector3(centers[v * 3], centers[v * 3 + 1], centers[v * 3 + 2]),
        influences,
        segment,
      });
    }
    const stride = Math.max(1, Math.floor(all.length / PROBES));
    return all.filter((_, i) => i % stride === 0);
  }

  /**
   * How far a posed finger's skin stays outside a shape, negative where it presses in, over the skin `segment`
   * carries or the whole finger. Each probe is skinned as the shader does it, about its own centre of rotation.
   */
  private skinClearance(shape: HandShape, side: Side, finger: number, pos: Vector3[], rot: Quaternion[], segment?: number) {
    const chain = this.bones[side][finger];
    const skins = chain.map((b, i) => {
      const rotation = rot[i].clone().multiply(new Quaternion(...b.bone.rotation).invert());
      return { rotation, translation: pos[i].clone().sub(new Vector3(...b.bone.position).applyQuaternion(rotation)) };
    });
    const wrist = this.wrists[side];
    const blended = new Quaternion();
    const carried = new Vector3();
    const term = new Vector3();
    const p = new Vector3();
    let least = Infinity;
    for (const probe of this.skins[side][finger]) {
      if (segment !== undefined && probe.segment !== segment) continue;
      const sum = [0, 0, 0, 0];
      carried.set(0, 0, 0);
      let pivot: Quaternion | null = null;
      for (const { segment: s, weight } of probe.influences) {
        const t = s < 0 ? wrist : skins[s];
        pivot ??= t.rotation;
        const w = pivot.dot(t.rotation) < 0 ? -weight : weight;
        sum[0] += w * t.rotation.x;
        sum[1] += w * t.rotation.y;
        sum[2] += w * t.rotation.z;
        sum[3] += w * t.rotation.w;
        carried.addScaledVector(term.copy(probe.center).applyQuaternion(t.rotation).add(t.translation), weight);
      }
      blended.set(sum[0], sum[1], sum[2], sum[3]).normalize();
      p.copy(probe.rest).sub(probe.center).applyQuaternion(blended).add(carried);
      least = Math.min(least, clearance(shape, p, p));
    }
    return least;
  }

  /** Each joint's world-in-wrist frame for a chain under the given local rotations, with the fingertip's pad point last. */
  private chainPose(chain: HandBone[], local: Quaternion[]) {
    const pos: Vector3[] = [];
    const rot: Quaternion[] = [];
    chain.forEach((b, i) => {
      const parentRot = rot[i - 1] ?? new Quaternion();
      pos.push(i === 0 ? b.position.clone() : b.offset.clone().applyQuaternion(parentRot).add(pos[i - 1]));
      rot.push(parentRot.clone().multiply(b.relative).multiply(local[i]));
    });
    const last = chain[2];
    pos.push(new Vector3(0, last.bone.tip - last.bone.pad, 0).applyQuaternion(rot[2]).add(pos[2]));
    return { pos, rot };
  }

  /** Each joint's flexion at rest, in radians, measured about its own flexion axis from the bone before it. */
  private restFlexion(chain: HandBone[]) {
    return chain.map((b, i) => {
      const before =
        i === 0
          ? b.position.clone().normalize()
          : new Vector3(0, 1, 0).applyQuaternion(chain[i - 1].rotation);
      const along = new Vector3(0, 1, 0).applyQuaternion(b.rotation);
      const x = new Vector3(1, 0, 0).applyQuaternion(b.rotation);
      return Math.atan2(before.clone().cross(along).dot(x), before.dot(along));
    });
  }

  /** The sign that turns a finger's abduction toward the thumb, and how far it already points that way at rest. */
  private spread(chain: HandBone[]) {
    const b = chain[0];
    const along = new Vector3(0, 1, 0).applyQuaternion(b.rotation);
    const pad = new Vector3(0, 0, 1).applyQuaternion(b.rotation);
    return { sign: Math.sign(pad.clone().cross(along).z) || 1, rest: Math.atan2(along.z, -along.y) };
  }

  /** Local rotations for every finger bone of one side, indexed like `LifterAsset.fingers`. */
  solve(side: Side, grip: HandGrip, radius = GRIP_SIZE[grip]): Map<number, Quaternion> {
    const s = sideSign(side);
    const palm = new Vector3(-s, 0, 0);
    const anchor = (name: string) => this.body.anchors[`${name}_${side}`].local.clone();
    const out = new Map<number, Quaternion>();
    const chains = this.bones[side];
    const cylinder = (center: Vector3, r: number): HandShape => ({
      kind: "cylinder",
      center: center.addScaledVector(palm, r - GRIP_RADIUS),
      axis: Z_AXIS.clone(),
      radius: r,
    });
    const plane: HandShape = { kind: "plane", point: anchor("palm"), normal: palm.clone().negate() };
    const g = grip === "hang" ? "bar" : grip;
    const shape: HandShape | null =
      g === "bar" || g === "neutral" || g === "hook"
        ? cylinder(anchor("grip"), radius)
        : g === "press"
          ? cylinder(anchor("press"), radius)
          : g === "fist"
            ? { kind: "cylinder", center: anchor("grip").setX(-s * (PALM_PLANE + radius - 0.003)), axis: Z_AXIS.clone(), radius }
            : g === "ball-stop"
              ? { kind: "sphere", center: anchor("grip").setX(-s * (PALM_PLANE + radius - 0.004)).setY(-0.1), radius }
              : g === "flat-floor" || g === "open"
                ? plane
                : null;

    const thumb = chains[0];
    // A hook grip wraps the thumb around the bar first and closes the index and middle fingers over its nail.
    let thumbLocal: Quaternion[] | null = null;
    let over: HandShape | null = null;
    if (g === "hook" && shape) {
      thumbLocal = this.solveThumb(side, palm, g, shape, thumb, chains, null, radius);
      const { pos } = this.chainPose(thumb, thumbLocal);
      over = {
        kind: "union",
        shapes: [shape, ...[1, 2].map((i): HandShape => ({ kind: "capsule", a: pos[i], b: pos[i + 1], radius: thumb[i].bone.back }))],
      };
    }
    const fingerPoses = chains.slice(1).map((chain, f) => {
      const closesOn = over && f < 2 ? over : shape;
      const rest = this.restFlexion(chain);
      const local = [new Quaternion(), new Quaternion(), new Quaternion()];
      const { sign, rest: restSpread } = this.spread(chain);
      let abd = 0;
      if (SPREAD[g]) abd = sign * (rad(SPREAD[g]![f]) - restSpread);
      if (shape?.kind === "cylinder") {
        // Square each finger's curl to the bar so the four close side by side around it.
        const x0 = new Vector3(1, 0, 0).applyQuaternion(chain[0].rotation);
        const z0 = new Vector3(0, 0, 1).applyQuaternion(chain[0].rotation);
        const axis = shape.axis.clone().multiplyScalar(Math.sign(x0.dot(shape.axis)) || 1);
        abd = clamp(Math.atan2(z0.clone().cross(x0).dot(axis), x0.dot(axis)), rad(-15), rad(15));
      }
      const fixed = g === "pinch" ? PINCH[f] : g === "relaxed" || !shape ? RELAXED[f] : null;
      if (fixed) {
        fixed.forEach((angle, i) => boneRotation(rad(angle) - rest[i], i === 0 ? abd : 0, 0, local[i]));
        return local;
      }
      // Close the way a hand does: all three joints together in the flexion synergy, each joint locking, with every
      // joint nearer the palm, once the skin of a phalanx past it meets the handle or the surface (GraspIt's auto-grasp).
      const angle = [0, 0, 0];
      const top = FINGER_FLEXION.map(rad);
      const active = [true, true, true];
      const set = () => angle.forEach((value, i) => boneRotation(value - rest[i], i === 0 ? abd : 0, 0, local[i]));
      const touching = () => {
        const { pos, rot } = this.chainPose(chain, local);
        for (let i = 2; i >= 0; i--) if (this.skinClearance(closesOn!, side, f + 1, pos, rot, i) < -SKIN) return i;
        return -1;
      };
      set();
      const step = rad(0.5);
      for (let n = 0; n < 600 && active.some(Boolean); n++) {
        const before = angle.slice();
        angle.forEach((_, i) => {
          if (active[i]) angle[i] = Math.min(angle[i] + SYNERGY[i] * step, top[i]);
          if (angle[i] >= top[i]) active[i] = false;
        });
        set();
        const hit = touching();
        if (hit < 0) continue;
        for (let i = 0; i <= hit; i++) {
          angle[i] = before[i];
          active[i] = false;
        }
        set();
      }
      return local;
    });
    chains.slice(1).forEach((chain, f) => chain.forEach((b, i) => out.set(b.index, fingerPoses[f][i])));

    thumbLocal ??= this.solveThumb(side, palm, g, shape, thumb, chains, fingerPoses, radius);
    thumb.forEach((b, i) => out.set(b.index, thumbLocal![i]));
    return out;
  }

  private solveThumb(
    side: Side,
    palm: Vector3,
    grip: HandGrip,
    shape: HandShape | null,
    thumb: HandBone[],
    chains: HandBone[][],
    /** The fingers as they close, or null when the thumb goes first and they close over it. */
    fingerPoses: Quaternion[][] | null,
    radius: number,
  ): Quaternion[] {
    const toLocal = (p: number[]) => [
      boneRotation(p[0], p[1], p[2]),
      boneRotation(p[3]),
      boneRotation(p[4]),
    ];
    if (grip === "relaxed") return toLocal([0, 0, 0, rad(8), rad(12)]);
    const fingers = fingerPoses ? chains.slice(1).map((chain, f) => this.chainPose(chain, fingerPoses[f])) : [];
    const fingerBone = (f: number, i: number) => chains[f + 1][i].bone;
    const pads = thumb.map((b) => b.bone.pad);
    let target: Vector3;
    let onShape = true;
    if (grip === "pinch") {
      // Pad to pad with the index and middle fingertips, a plate's thickness apart.
      const tip = fingers[0].pos[3].clone().add(fingers[1].pos[3]).multiplyScalar(0.5);
      const padDir = new Vector3(0, 0, 1).applyQuaternion(fingers[0].rot[2]);
      target = tip.addScaledVector(padDir, fingerBone(0, 2).pad + 2 * radius + pads[2]);
      onShape = false;
    } else if (shape?.kind === "plane") {
      const spread = rad(grip === "flat-floor" ? 52 : 34);
      const reach = thumb[1].bone.length + thumb[2].bone.tip;
      const base = thumb[1].position.clone();
      target = base.addScaledVector(new Vector3(0, -Math.cos(spread), Math.sin(spread)), reach * 0.92);
      target.addScaledVector(shape.normal, pads[2] - clearance(shape, target, target));
    } else {
      // Closed around the far side of the handle from the palm, level with the index finger's knuckle, and laid over
      // any finger that already wraps that far. A hook carries on a little further round, under the fingertips.
      const centre = (shape as { center: Vector3 }).center.clone();
      if (shape!.kind === "cylinder") centre.addScaledVector(shape!.axis, chains[1][0].position.clone().sub(centre).dot(shape!.axis) * 0.7);
      const round = grip === "hook" ? rad(35) : 0;
      const around = palm.clone().multiplyScalar(Math.cos(round)).addScaledVector(Y_AXIS, -Math.sin(round));
      target = centre.clone().addScaledVector(around, radius + pads[2]);
      for (let pass = 0; pass < 3; pass++) {
        for (let f = 0; f < fingers.length && f < 2; f++) {
          for (let i = 0; i < 3; i++) {
            const fp = fingers[f].pos;
            const d = closestSegments(target, target, fp[i], fp[i + 1]).distance;
            const room = pads[2] + fingerBone(f, i).back;
            if (d < room) target.addScaledVector(outward(shape!, target), room - d);
          }
        }
      }
    }

    const residuals = (p: number[]) => {
      const { pos, rot } = this.chainPose(thumb, toLocal(p));
      const r: number[] = [];
      for (let k = 0; k < 3; k++) r.push(3 * (pos[3].getComponent(k) - target.getComponent(k)));
      if (shape) {
        for (let i = 0; i < 3; i++) {
          const c = this.skinClearance(shape, side, 0, pos, rot, i);
          r.push(40 * Math.max(0, -SKIN - c));
          if (onShape && shape.kind !== "plane" && i === 1) r.push(0.6 * c);
          if (shape.kind === "plane" && i > 0) r.push(4 * c);
        }
      }
      // Never through a finger.
      for (let f = 0; f < fingers.length && f < 2; f++) {
        for (let i = 0; i < 3; i++) {
          const fp = fingers[f].pos;
          for (let t = 1; t < 3; t++) {
            const d = closestSegments(pos[t], pos[t + 1], fp[i], fp[i + 1]).distance;
            r.push(8 * Math.max(0, pads[t] + fingerBone(f, i).back - 0.002 - d));
          }
        }
      }
      p.forEach((value) => r.push(0.05 * value));
      return r;
    };
    const cost = (r: number[]) => r.reduce((sum, v) => sum + v * v, 0);
    const refine = (start: number[]) => {
      const params = start.map(rad);
      const n = params.length;
      let r = residuals(params);
      let total = cost(r);
      let lambda = 1e-3;
      for (let iteration = 0; iteration < 80; iteration++) {
        const J: number[][] = [];
        for (let j = 0; j < n; j++) {
          const trial = params.slice();
          trial[j] += 1e-5;
          const rj = residuals(trial);
          J.push(rj.map((v, i) => (v - r[i]) / 1e-5));
        }
        const A = new Float64Array(n * n);
        const g = new Float64Array(n);
        for (let a = 0; a < n; a++) {
          for (let i = 0; i < r.length; i++) g[a] -= J[a][i] * r[i];
          for (let b = 0; b < n; b++) for (let i = 0; i < r.length; i++) A[a * n + b] += J[a][i] * J[b][i];
        }
        let improved = false;
        for (let attempt = 0; attempt < 6 && !improved; attempt++) {
          const M = Float64Array.from(A);
          const delta = Float64Array.from(g);
          for (let a = 0; a < n; a++) M[a * n + a] += lambda * (A[a * n + a] + 1e-6);
          if (!solveCholesky(M, delta, n)) {
            lambda *= 10;
            continue;
          }
          const trial = params.map((v, a) => clamp(v + delta[a], rad(THUMB_RANGE[a][0]), rad(THUMB_RANGE[a][1])));
          const next = residuals(trial);
          const nextCost = cost(next);
          if (nextCost < total) {
            params.splice(0, n, ...trial);
            r = next;
            improved = total - nextCost > 1e-14;
            total = nextCost;
            lambda = Math.max(lambda / 3, 1e-7);
          } else {
            lambda *= 4;
          }
        }
        if (!improved) break;
      }
      return { params, total };
    };
    // The thumb's base has a basin where it lies along the bar instead of around it, so it starts from a few shapes.
    return toLocal(THUMB_STARTS.map(refine).reduce((a, b) => (b.total < a.total ? b : a)).params);
  }
}

/** One grip for both hands, or one per hand. Legacy grip styles are the same names. */
export function handGrips(config: HandGripConfig): Record<Side, { grip: HandGrip; radius?: number }> {
  if (typeof config === "string") return { L: { grip: config }, R: { grip: config } };
  return { L: { grip: config.L, radius: config.radiusL }, R: { grip: config.R, radius: config.radiusR } };
}

let preloadedAsset: LifterAsset | null = null;
let preloadedMuscleMapUrl: string | null = null;

export async function preloadFigureAssets(basePath = "."): Promise<void> {
  const inline = document.getElementById("lifter")?.textContent?.trim();
  if (inline && inline !== "__LIFTER__") {
    const bytes = Uint8Array.from(atob(inline), (c) => c.charCodeAt(0));
    preloadedAsset = decodeLifter(bytes.buffer);
    const mapText = document.getElementById("muscle-map")?.textContent?.trim();
    if (mapText && mapText !== "__MUSCLE_MAP__") {
      preloadedMuscleMapUrl = `data:image/png;base64,${mapText}`;
    }
    return;
  }
  const resp = await fetch(`${basePath}/lifter.bin`);
  if (!resp.ok) throw new Error(`Failed to fetch ${basePath}/lifter.bin (${resp.status})`);
  preloadedAsset = decodeLifter(await resp.arrayBuffer());
  preloadedMuscleMapUrl = `${basePath}/muscle-map.png`;
}

function readAsset(): LifterAsset {
  if (preloadedAsset) return preloadedAsset;
  const element = document.getElementById("lifter");
  if (!element?.textContent) throw new Error("The page has no lifter mesh");
  const bytes = Uint8Array.from(atob(element.textContent.trim()), (c) => c.charCodeAt(0));
  preloadedAsset = decodeLifter(bytes.buffer);
  return preloadedAsset;
}

interface Rest {
  position: Vector3;
  rotation: Quaternion;
}

export class Figure {
  readonly group = new Group();
  private readonly asset: LifterAsset;
  private readonly mesh: Mesh;
  private readonly bind: Rest[];
  private readonly fingerRest: Rest[];
  /** Each finger bone's parent: a rig joint index, or a finger bone's own index past the rig joints. */
  private readonly fingerParent: number[];
  private readonly posed: Rest[];
  /** Each joint's skin transform, posed times rest inverse: a rotation and the translation after it. */
  private readonly rotation: Vector4[];
  private readonly translation: Vector3[];
  private readonly hands: HandRig;
  private readonly fingerPose = new Map<number, Quaternion>();
  private gripKey = "";
  private readonly colors = [BODY, ...Array.from({ length: MUSCLES.length * 2 }, () => PLATE.clone())];
  private readonly q = new Quaternion();
  private readonly t = new Vector3();

  constructor(private readonly body: Body) {
    this.asset = readAsset();
    const jointCount = body.joints.length + this.asset.fingers.length;
    const rest = (position: number[], rotation: number[]) => ({
      position: new Vector3(...position),
      rotation: new Quaternion(...rotation),
    });
    this.bind = this.asset.bind.map((frame) => rest(frame.position, frame.rotation));
    this.fingerRest = this.asset.fingers.map((bone) => rest(bone.position, bone.rotation));
    this.fingerParent = this.asset.fingers.map((bone) => {
      const rig = body.index[bone.parent];
      return rig ?? body.joints.length + this.asset.fingers.findIndex((other) => other.name === bone.parent);
    });
    this.posed = Array.from({ length: jointCount }, () => ({ position: new Vector3(), rotation: new Quaternion() }));
    this.rotation = Array.from({ length: jointCount }, () => new Vector4(0, 0, 0, 1));
    this.translation = Array.from({ length: jointCount }, () => new Vector3());
    this.hands = new HandRig(this.asset, body);
    this.setGrip("hang");

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.asset.positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(this.asset.normals, 3));
    geometry.setAttribute("uv", new BufferAttribute(this.asset.uvs, 2));
    geometry.setAttribute("rotationCenter", new BufferAttribute(this.asset.centers, 3));
    geometry.setAttribute("jointIndex", new BufferAttribute(this.asset.skinIndex, 4));
    geometry.setAttribute("jointWeight", new BufferAttribute(this.asset.skinWeight, 4, true));
    geometry.setIndex(new BufferAttribute(this.asset.indices, 1));

    // Red is each texel's relief, which also lights the grooves as bump; green names its plate, read exactly.
    const map = new Texture();
    map.flipY = true;
    map.generateMipmaps = false;
    map.magFilter = NearestFilter;
    const relief = new Texture();
    relief.flipY = true;
    const image = new Image();
    image.onload = () => {
      map.image = image;
      relief.image = image;
      map.needsUpdate = true;
      relief.needsUpdate = true;
    };
    image.src =
      preloadedMuscleMapUrl ??
      `data:image/png;base64,${document.getElementById("muscle-map")?.textContent?.trim()}`;
    const material = new MeshStandardMaterial({ bumpMap: relief, bumpScale: 1.6, roughness: 0.66, metalness: 0.02 });
    // Each vertex turns by the blend of its joints' rotations about its own centre of rotation, which the joints carry
    // as linear blending would. That keeps volume at a deep bend without the bulge dual quaternions leave.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.jointRotation = { value: this.rotation };
      shader.uniforms.jointTranslation = { value: this.translation };
      shader.uniforms.muscleMap = { value: map };
      shader.uniforms.musclePalette = { value: this.colors };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform sampler2D muscleMap;
          uniform vec3 musclePalette[${this.colors.length}];`,
        )
        .replace(
          "#include <color_fragment>",
          `ivec2 texel = ivec2(vBumpMapUv * vec2(textureSize(muscleMap, 0)));
          int plate = int(round(texelFetch(muscleMap, texel, 0).g * 255.0));
          float rise = smoothstep(0.12, 0.55, texture2D(bumpMap, vBumpMapUv).r);
          diffuseColor.rgb = mix(musclePalette[0], musclePalette[plate], plate > 0 ? rise : 0.0);`,
        );
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute vec4 jointIndex;
          attribute vec4 jointWeight;
          attribute vec3 rotationCenter;
          uniform vec4 jointRotation[${jointCount}];
          uniform vec3 jointTranslation[${jointCount}];
          vec3 rotateSkin(vec4 q, vec3 v) {
            return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
          }`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `vec4 pivot = jointRotation[int(jointIndex.x)];
          vec4 blended = vec4(0.0);
          vec3 carried = vec3(0.0);
          for (int k = 0; k < 4; k++) {
            float w = jointWeight[k];
            if (w == 0.0) continue;
            int j = int(jointIndex[k]);
            vec4 r = jointRotation[j];
            blended += (dot(pivot, r) < 0.0 ? -w : w) * r;
            carried += w * (rotateSkin(r, rotationCenter) + jointTranslation[j]);
          }
          vec4 rotation = normalize(blended);
          vec3 translation = carried - rotateSkin(rotation, rotationCenter);
          vec3 objectNormal = rotateSkin(rotation, normal);`,
        )
        .replace("#include <begin_vertex>", "vec3 transformed = rotateSkin(rotation, position) + translation;");
    };

    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /** Poses both hands for a grip, or each hand for its own, closing the fingers on the handle's radius. */
  setGrip(config: HandGripConfig) {
    const key = JSON.stringify(config);
    if (key === this.gripKey) return;
    this.gripKey = key;
    const grips = handGrips(config);
    for (const side of SIDES) {
      for (const [index, rotation] of this.hands.solve(side, grips[side].grip, grips[side].radius))
        this.fingerPose.set(index, rotation);
    }
  }

  setPressGrip(enabled: boolean) {
    this.setGrip(enabled ? "press" : "hang");
  }

  pose(frame: Frame) {
    const rig = this.body.joints.length;
    for (let j = 0; j < rig; j++) {
      this.posed[j].position.copy(frame.pos[j]);
      this.posed[j].rotation.copy(frame.rot[j]);
      this.setSkin(j, this.bind[j]);
    }
    this.asset.fingers.forEach((bone, f) => {
      const parent = this.fingerParent[f];
      const parentRest = parent < rig ? this.bind[parent] : this.fingerRest[parent - rig];
      const parentPosed = this.posed[parent];
      const rest = this.fingerRest[f];
      const posed = this.posed[rig + f];
      const local = this.q.copy(parentRest.rotation).invert();
      this.t.copy(rest.position).sub(parentRest.position).applyQuaternion(local);
      posed.position.copy(this.t).applyQuaternion(parentPosed.rotation).add(parentPosed.position);
      posed.rotation.copy(parentPosed.rotation).multiply(local.multiply(rest.rotation)).multiply(this.fingerPose.get(f)!);
      this.setSkin(rig + f, rest);
    });
  }

  /** The skin transform posed * rest⁻¹. */
  private setSkin(index: number, rest: Rest) {
    const posed = this.posed[index];
    const q = this.q.copy(rest.rotation).invert().premultiply(posed.rotation);
    this.rotation[index].set(q.x, q.y, q.z, q.w);
    this.translation[index].copy(rest.position).applyQuaternion(q).negate().add(posed.position);
  }

  bounds() {
    const box = new Box3();
    const { positions, centers, skinIndex, skinWeight } = this.asset;
    const blended = new Vector4();
    const carried = new Vector3();
    const center = new Vector3();
    const joint = new Quaternion();
    const q = new Quaternion();
    const p = new Vector3();
    const term = new Vector3();
    for (let i = 0; i < positions.length / 3; i++) {
      const pivot = this.rotation[skinIndex[i * 4]];
      blended.set(0, 0, 0, 0);
      carried.set(0, 0, 0);
      center.fromArray(centers, i * 3);
      for (let k = 0; k < 4; k++) {
        const w = skinWeight[i * 4 + k] / 255;
        if (w === 0) continue;
        const r = this.rotation[skinIndex[i * 4 + k]];
        blended.addScaledVector(r, pivot.dot(r) < 0 ? -w : w);
        joint.set(r.x, r.y, r.z, r.w);
        carried.addScaledVector(term.copy(center).applyQuaternion(joint).add(this.translation[skinIndex[i * 4 + k]]), w);
      }
      q.set(blended.x, blended.y, blended.z, blended.w).normalize();
      p.fromArray(positions, i * 3).sub(center).applyQuaternion(q).add(carried);
      box.expandByPoint(p);
    }
    return box;
  }

  /**
   * Colours each muscle from a ramp of evenly spaced stops, 0 at the first and 1 at the last. It is continuous from
   * zero: a muscle that starts to work fades in from the resting plate instead of appearing at a threshold.
   */
  tint(values: ArrayLike<number>, ramp: Color[]) {
    const last = ramp.length - 1;
    for (let i = 0; i < this.colors.length - 1; i++) {
      const at = Math.min(1, Math.max(0, values[i])) * last;
      const stop = Math.min(last - 1, Math.floor(at));
      this.colors[i + 1].copy(ramp[stop]).lerp(ramp[stop + 1], at - stop);
    }
  }
}
