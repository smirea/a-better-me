import { Vector3 } from "three";
import { anchorPoint, selfCollisionPairs, SIDES, type Body } from "./body";
import type { Analysis } from "./biomech";
import { compileParts, propParts, signedDistance, surfaceSamples, type Shape } from "./equipment";
import type { Built, CheckResult, Kinematics, Sequence } from "./exercise";
import { CYLINDER_GRIPS, graspHandleAt, gripCenter, propEye, propPointWorld } from "./grasp";
import { machineSpec } from "./machines/core";
import { closestSegments, deg, quatFromRotVec, rad, rotVecFromQuat } from "./math";
import { MUSCLE_NAMES, MUSCLES, TENDONS, type Muscle } from "./muscles";
import {
  capsulePenetration,
  capsulesInWorld,
  jointRanges,
  limitViolations,
  newCapsules,
  obstaclePenetration,
} from "./solver";

export interface Issue {
  code:
    | "joint-limit"
    | "self-collision"
    | "equipment-clip"
    | "glb-clip"
    | "cable-clip"
    | "floor"
    | "contact-lost"
    | "grip"
    | "contact-slides"
    | "too-fast"
    | "jerky"
    | "asymmetric"
    | "loop"
    | "muscle-flicker"
    | "muscle-mismatch"
    | "off-balance"
    | "overload"
    | "overstretch";
  severity: "error" | "warning";
  title: string;
  detail: string;
  /** Inclusive frame ranges where it happens. */
  frames: [number, number][];
}

/** Thresholds, each chosen as the point past which a person couldn't or wouldn't do what the frames show. */
const LIMITS = {
  jointExcess: 1.5,
  /** A joint this close to a limit, in degrees, is pinned there: a pose the solver forced, not one a lifter chooses. */
  pinnedMargin: 1.5,
  /** Share of the rep a joint may sit pinned before it reads as a forced pose. */
  pinnedShare: 0.4,
  clip: 0.004,
  contactGap: 0.012,
  /** How far a handle's axis may sit off the centre of the closed fingers before the hand visibly misses it. */
  gripOffAxis: 0.008,
  /** How far the shaft may turn out of the line the fingers wrap along, in degrees. */
  gripTwist: 20,
  /** How far the palm may roll around a machine handle from the way it's meant to be held, in degrees. */
  palmRoll: 60,
  /** How far past a handle's end the hand's centre may sit. */
  gripOverhang: 0.01,
  /** For grips that don't wrap a cylinder (a ball stop, a plate pinch): grip anchor to handle centre. */
  gripReach: 0.04,
  /** How far a tether's end may sit from the eye or anchor it's clipped to. */
  tetherEnd: 0.01,
  /** How closely an attachment's eye must face along its cable (cosine): about 60° off before it reads as wrong. */
  eyeFacing: 0.5,
  /** How deep one piece of equipment may sit in another: a bar seated in a J-hook cradle, not through an upright. */
  propClip: 0.01,
  slide: 0.012,
  /** Controlled lifting stays well under the 400°/s a joint reaches in a throw or a sprint. */
  speed: 260,
  /** A step between frames this large reads as a pop, not as fast movement. */
  jump: 9,
  acceleration: 3000,
  asymmetry: 3,
  balanceMargin: 0.01,
  overload: 0.08,
  stretch: 1,
  tendonLoad: 1.15,
  /** How far a muscle's effort must rise and fall again to count as one burst of work, as a share of its peak. */
  burst: 0.3,
  /** A muscle working under this never reads as flickering, whatever its shape. */
  burstFloor: 0.12,
  /** How hard a muscle the exercise doesn't list may work, against the hardest-working one it does list. */
  unlistedShare: 2 / 3,
  /** A listed prime mover working under this share of the hardest-working muscle is one the pose leaves out. */
  primaryShare: 0.25,
};

function ranges(flags: boolean[]) {
  const out: [number, number][] = [];
  flags.forEach((flag, i) => {
    if (!flag) return;
    const last = out[out.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else out.push([i, i]);
  });
  return out;
}

class Collector {
  private worst = new Map<
    string,
    { value: number; flags: boolean[]; make: (value: number) => Omit<Issue, "frames"> }
  >();
  constructor(private frames: number) {}

  add(key: string, frame: number, value: number, make: (value: number) => Omit<Issue, "frames">) {
    let entry = this.worst.get(key);
    if (!entry) {
      entry = { value, flags: Array.from({ length: this.frames }, () => false), make };
      this.worst.set(key, entry);
    }
    entry.value = Math.max(entry.value, value);
    entry.flags[frame] = true;
  }

  issues(): Issue[] {
    return [...this.worst.values()].map((entry) => {
      const issue = entry.make(entry.value);
      return {
        ...issue,
        title: issue.title[0].toUpperCase() + issue.title.slice(1),
        frames: ranges(entry.flags),
      };
    });
  }
}

const pretty = (id: string) =>
  id
    .replace(/_L$/, " (left)")
    .replace(/_R$/, " (right)")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace("upperarm", "upper arm");
const cm = (metres: number) => `${(metres * 100).toFixed(1)} cm`;

/** Everything about the motion itself that a person wouldn't or couldn't do, whatever weight is on the bar. */
export function validateMotion(body: Body, sequence: Sequence, kin: Kinematics): Issue[] {
  const count = sequence.poses.length;
  const collector = new Collector(count);
  const pairs = selfCollisionPairs(body);
  const capsules = newCapsules(body);
  const fixed = compileParts(sequence.equipment.filter((part) => part.collide));
  const allEquipmentById = new Map(compileParts(sequence.equipment).map((s) => [s.part.id, s]));
  const allowance = (partId: string, collider: Body["colliders"][number]) => {
    let best = 0;
    for (const [prefix, allowed] of Object.entries(sequence.contacts)) {
      if (!partId.startsWith(prefix)) continue;
      const direct = allowed[collider.id];
      const alias = collider.contactAs ? allowed[collider.contactAs] : undefined;
      if (direct !== undefined) best = Math.max(best, direct);
      else if (alias !== undefined) best = Math.max(best, alias);
    }
    return best;
  };
  const visible = body.colliders
    .map((collider, i) => (collider.visible ? i : -1))
    .filter((i) => i >= 0);
  const slides = new Map<string, { min: Vector3; max: Vector3 }>();
  const pinned = new Map<string, number>();

  for (let f = 0; f < count; f++) {
    const frame = kin.frames[f];
    jointRanges(body, sequence.poses[f], kin.angles[f], (key, value, lo, hi) => {
      if (Math.min(value - lo, hi - value) < rad(LIMITS.pinnedMargin)) pinned.set(key, (pinned.get(key) ?? 0) + 1);
    });
    limitViolations(body, sequence.poses[f], kin.angles[f], (key, excess) => {
      const degrees = Math.abs(deg(excess));
      if (degrees <= LIMITS.jointExcess) return;
      collector.add(`limit:${key}`, f, degrees, (worst) => ({
        code: "joint-limit",
        severity: worst > 6 ? "error" : "warning",
        title: `${pretty(key.split(".")[0])} past its range`,
        detail: `${key.split(".")[1]} goes ${worst.toFixed(0)}° beyond what the joint allows`,
      }));
    });

    capsulesInWorld(body, frame, capsules);
    for (const [i, j, tolerance] of pairs) {
      const depth = capsulePenetration(body, capsules, i, j) - tolerance;
      if (depth <= LIMITS.clip) continue;
      const a = body.colliders[i].id.replace("thighShaft", "thigh");
      const b = body.colliders[j].id;
      collector.add(`self:${a}:${b}`, f, depth, (worst) => ({
        code: "self-collision",
        severity: worst > 0.02 ? "error" : "warning",
        title: `${pretty(a)} clips through ${pretty(b)}`,
        detail: `${cm(worst)} deeper than soft tissue gives`,
      }));
    }

    const shapes: Shape[] = [...fixed];
    sequence.props.forEach((prop, p) =>
      shapes.push(...compileParts(propParts(prop, sequence.loadKg), sequence.propStates[f][p])),
    );
    for (const shape of shapes) {
      for (const i of visible) {
        const collider = body.colliders[i];
        const depth = obstaclePenetration(body, capsules, i, shape) - allowance(shape.part.id, collider);
        if (depth <= LIMITS.clip) continue;
        collector.add(`clip:${collider.id}:${shape.part.id}`, f, depth, (worst) => ({
          code: "equipment-clip",
          severity: worst > 0.02 ? "error" : "warning",
          title: `${pretty(collider.id)} clips through ${shape.part.id.split(".").map(pretty).join(" ")}`,
          detail: `${cm(worst)} inside it`,
        }));
      }
    }

    // Equipment against equipment: two dumbbells at the top of a curl, a bar swung through a rack upright.
    const propShapes = sequence.props.map((prop, p) =>
      compileParts(propParts(prop, sequence.loadKg).filter((part) => part.collide), sequence.propStates[f][p]),
    );
    // Tested both ways, so a collider fully inside another is caught whichever comes first.
    const sameOwner = (a: Shape, b: Shape) => a.part.owner !== undefined && a.part.owner === b.part.owner;
    const deepest = (from: Shape[], into: Shape[]) => {
      let depth = 0;
      let part = "";
      for (const shape of from) {
        for (const target of into) {
          if (sameOwner(shape, target)) continue;
          if (shape.pos.distanceTo(target.pos) > shape.bound + target.bound) continue;
          for (const point of surfaceSamples(shape)) {
            const d = -signedDistance(target, point);
            if (d > depth) {
              depth = d;
              part = target.part.id;
            }
          }
        }
      }
      return { depth, part };
    };
    const staticColliders = fixed;
    for (let a = 0; a < propShapes.length; a++) {
      const others: { id: string; shapes: Shape[] }[] = [{ id: "equipment", shapes: staticColliders }];
      for (let b = a + 1; b < propShapes.length; b++) others.push({ id: sequence.props[b].id, shapes: propShapes[b] });
      for (const other of others) {
        const there = deepest(propShapes[a], other.shapes);
        const back = deepest(other.shapes, propShapes[a]);
        const hit = there.depth >= back.depth ? there : { depth: back.depth, part: other.id };
        if (hit.depth > LIMITS.propClip) {
          const name = sequence.props[a].id;
          collector.add(`prop-clip:${name}:${other.id}`, f, hit.depth, (worst) => ({
            code: "equipment-clip",
            severity: "error",
            title: `${name.split(".").map(pretty).join(" ")} passes through ${hit.part.split(".").map(pretty).join(" ")}`,
            detail: `${cm(worst)} deep; equipment can't overlap equipment`,
          }));
        }
      }
    }

    for (const i of visible) {
      const collider = body.colliders[i];
      const low = Math.min(capsules.a[i].y - collider.ra, capsules.b[i].y - collider.rb);
      if (low < -0.012) {
        collector.add(`floor:${collider.id}`, f, -low, (worst) => ({
          code: "floor",
          severity: "error",
          title: `${pretty(collider.id)} sinks into the floor`,
          detail: `${cm(worst)} below it`,
        }));
      }
    }

    const frameTethers = sequence.tetherStates?.[f];
    if (frameTethers?.length) {
      const p0 = new Vector3();
      const p1 = new Vector3();
      for (let tIdx = 0; tIdx < frameTethers.length; tIdx++) {
        const pts = frameTethers[tIdx].points;
        const tetherId = sequence.tethers?.[tIdx]?.id ?? `cable_${tIdx}`;
        const def = sequence.tethers?.[tIdx];
        const tetherR = def?.radius ?? 0.004;
        if (def?.kind === "cable" && !def.attach) {
          throw new Error(`Cable "${tetherId}" doesn't say what it's clipped to; set attach (cableTether does)`);
        }
        if (def?.attach) {
          const end = new Vector3(...pts[pts.length - 1]);
          let target: Vector3;
          if ("prop" in def.attach) {
            const p = sequence.props.findIndex((prop) => prop.id === (def.attach as { prop: string }).prop);
            const prop = sequence.props[p];
            if (!prop || prop.kind !== "glb") throw new Error(`Cable "${tetherId}" attaches to unknown prop`);
            const eye = machineSpec(prop.glbId.replace(/^machines\//, "")).anchors.points?.eye;
            if (!eye) throw new Error(`Cable "${tetherId}": ${prop.glbId} has no cable eye`);
            target = propPointWorld(prop, sequence.propStates[f][p], eye.pos);
          } else {
            target = anchorPoint(body, frame, def.attach.anchor);
          }
          if ("prop" in def.attach && pts.length >= 2) {
            const p = sequence.props.findIndex((prop) => prop.id === (def.attach as { prop: string }).prop);
            const prop = sequence.props[p];
            const eyeLocal = propEye(prop);
            if (eyeLocal) {
              // A cable under tension swings its attachment so the eye faces it; pulling from behind the bar is wrong.
              const centre = propPointWorld(prop, sequence.propStates[f][p], [0, 0, 0]);
              const outward = target.clone().sub(centre).normalize();
              const pull = new Vector3(...pts[pts.length - 2]).sub(end).normalize();
              const facing = outward.dot(pull);
              if (facing < LIMITS.eyeFacing) {
                collector.add(`tether-side:${tetherId}`, f, 1 - facing, () => ({
                  code: "cable-clip",
                  severity: "error",
                  title: `${pretty(tetherId)} pulls ${prop.id} from the wrong side`,
                  detail: `the attachment's eye faces away from its cable; roll it toward the pulley (carryProp toward)`,
                }));
              }
            }
          }
          const off = end.distanceTo(target);
          if (off > LIMITS.tetherEnd) {
            collector.add(`tether-end:${tetherId}`, f, off, (worst) => ({
              code: "cable-clip",
              severity: "error",
              title: `${pretty(tetherId)} isn't clipped to what it pulls`,
              detail: `its end sits ${cm(worst)} from the attachment's eye`,
            }));
          }
        }
        for (let seg = 0; seg + 1 < pts.length; seg++) {
          p0.set(...pts[seg]);
          p1.set(...pts[seg + 1]);
          for (const i of visible) {
            const col = body.colliders[i];
            // The cable leaves the attachment right behind the hand, so only the hand itself may touch it.
            if (col.id.startsWith("hand_")) continue;
            const hit = closestSegments(p0, p1, capsules.a[i], capsules.b[i]);
            const colR = col.ra + (col.rb - col.ra) * hit.t;
            const pen = colR + tetherR - hit.distance;
            if (pen > 0.015) {
              collector.add(`cable:${tetherId}:${col.id}`, f, pen, (worst) => ({
                code: "cable-clip",
                severity: worst > 0.025 ? "error" : "warning",
                title: `${pretty(tetherId)} cuts through ${pretty(col.id)}`,
                detail: `${cm(worst)} inside the body`,
              }));
            }
          }
        }
      }
    }

    for (const grasp of sequence.grasps ?? []) {
      const handle = graspHandleAt(grasp, sequence.props, sequence.propStates[f]);
      const hand = grasp.side === "L" ? "Left hand" : "Right hand";
      const centre = gripCenter(body, frame, grasp.side, grasp.grip, grasp.handle.radius).sub(handle.pos);
      if (!CYLINDER_GRIPS.has(grasp.grip)) {
        const reach = centre.length();
        if (reach > LIMITS.gripReach) {
          collector.add(`grip-reach:${grasp.side}`, f, reach, (worst) => ({
            code: "grip",
            severity: "error",
            title: `${hand} misses its ${grasp.grip} grip`,
            detail: `grip anchor sits ${cm(worst)} from the handle`,
          }));
        }
        continue;
      }
      const along = centre.dot(handle.axis);
      const off = centre.addScaledVector(handle.axis, -along).length();
      if (off > LIMITS.gripOffAxis) {
        collector.add(`grip-off:${grasp.side}`, f, off, (worst) => ({
          code: "grip",
          severity: "error",
          title: `${hand} is off its handle`,
          detail: `the handle's axis passes ${cm(worst)} from the centre of the closed fingers`,
        }));
      }
      const overhang = Math.abs(along) - grasp.handle.length / 2;
      if (overhang > LIMITS.gripOverhang) {
        collector.add(`grip-end:${grasp.side}`, f, overhang, (worst) => ({
          code: "grip",
          severity: "error",
          title: `${hand} slides off the end of its handle`,
          detail: `the hand's centre sits ${cm(worst)} past the end of the gripping surface`,
        }));
      }
      if (grasp.orient) {
        const palm = new Vector3(-(grasp.side === "L" ? 1 : -1), 0, 0).applyQuaternion(frame.rot[body.index[`wrist_${grasp.side}`]]);
        const roll = deg(Math.acos(Math.max(-1, Math.min(1, palm.dot(handle.palmNormal)))));
        if (roll > LIMITS.palmRoll) {
          collector.add(`grip-roll:${grasp.side}`, f, roll, (worst) => ({
            code: "grip",
            severity: "error",
            title: `${hand} is rolled around its handle`,
            detail: `the palm faces ${worst.toFixed(0)}° away from the way this handle is held`,
          }));
        }
      }
      const shaft = new Vector3(0, 0, 1).applyQuaternion(frame.rot[body.index[`wrist_${grasp.side}`]]);
      const twist = deg(Math.acos(Math.min(1, Math.abs(shaft.dot(handle.axis)))));
      if (twist > LIMITS.gripTwist) {
        collector.add(`grip-twist:${grasp.side}`, f, twist, (worst) => ({
          code: "grip",
          severity: "error",
          title: `${hand} is twisted across its handle`,
          detail: `the handle runs ${worst.toFixed(0)}° out of line with the closed fingers`,
        }));
      }
    }

    for (const contact of sequence.required) {
      const point = anchorPoint(body, frame, contact.anchor);
      let gap = 0;
      if (contact.surfaceY !== undefined) {
        gap = Math.abs(point.y - contact.surfaceY);
        if (!contact.allowSlide) {
          const seen = slides.get(contact.label) ?? { min: point.clone(), max: point.clone() };
          seen.min.min(point);
          seen.max.max(point);
          slides.set(contact.label, seen);
        }
      } else if (contact.part !== undefined) {
        let partShape = allEquipmentById.get(contact.part);
        if (!partShape) partShape = shapes.find((s) => s.part.id === contact.part);
        if (!partShape) {
          throw new Error(`Required contact "${contact.label}" references missing part "${contact.part}"`);
        }
        gap = Math.max(0, signedDistance(partShape, point));
        if (!contact.allowSlide) {
          // Measured in the part's own frame, so riding a moving sled isn't sliding and sliding across it is.
          const local = point.clone().sub(partShape.pos).applyQuaternion(partShape.inverse);
          const seen = slides.get(contact.label) ?? { min: local.clone(), max: local.clone() };
          seen.min.min(local);
          seen.max.max(local);
          slides.set(contact.label, seen);
        }
      } else {
        const p = sequence.props.findIndex((prop) => prop.id === contact.prop);
        if (p < 0) {
          throw new Error(`Required contact "${contact.label}" references missing prop "${contact.prop}"`);
        }
        const handles = compileParts(
          propParts(sequence.props[p], sequence.loadKg),
          sequence.propStates[f][p],
        );
        gap = Math.max(0, Math.min(...handles.map((h) => signedDistance(h, point))));
      }
      if (gap > LIMITS.contactGap) {
        collector.add(`contact:${contact.label}`, f, gap, (worst) => ({
          code: "contact-lost",
          severity: "error",
          title: `${contact.label}: contact lost`,
          detail: `${cm(worst)} away from where it should rest`,
        }));
      }
    }
  }

  for (const [key, frames] of pinned) {
    if (frames / count < LIMITS.pinnedShare) continue;
    collector.add(`pinned:${key}`, 0, frames / count, (share) => ({
      code: "joint-limit",
      severity: "warning",
      title: `${pretty(key.split(".")[0])} held at the end of its range`,
      detail: `${key.split(".")[1]} sits within ${LIMITS.pinnedMargin}° of its limit for ${Math.round(100 * share)}% of the rep; something in the setup is forcing it`,
    }));
  }
  for (const [label, seen] of slides) {
    const slide = Math.hypot(seen.max.x - seen.min.x, seen.max.z - seen.min.z);
    if (slide > LIMITS.slide) {
      collector.add(`slide:${label}`, 0, slide, (worst) => ({
        code: "contact-slides",
        severity: "warning",
        title: `${label}: slides`,
        detail: `moves ${cm(worst)} across the surface during the rep`,
      }));
    }
  }

  const dt = 1 / sequence.fps;
  const qa = quatFromRotVec(0, 0, 0);
  const qb = quatFromRotVec(0, 0, 0);
  /** One frame's signed rotation of a joint, in degrees per axis, so a reversal shows as a change of sign. */
  const step = (joint: (typeof body.joints)[number], a: number[], b: number[]): number[] => {
    const i = joint.kind === "root" ? 3 : joint.dofStart;
    if (joint.kind === "hinge" || joint.kind === "universal")
      return joint.dofs.map((_, n) => deg(b[i + n] - a[i + n]));
    quatFromRotVec(a[i], a[i + 1], a[i + 2], qa);
    quatFromRotVec(b[i], b[i + 1], b[i + 2], qb);
    return rotVecFromQuat(qa.invert().multiply(qb)).map(deg);
  };
  for (const joint of body.joints) {
    for (let f = 0; f < count; f++) {
      const previous = sequence.poses[(f - 1 + count) % count];
      const current = sequence.poses[f];
      const next = sequence.poses[(f + 1) % count];
      const before = step(joint, previous, current);
      const after = step(joint, current, next);
      const moved = Math.hypot(...before);
      const speed = moved / dt;
      const name = pretty(joint.name);
      if (moved > LIMITS.jump) {
        collector.add(`jump:${joint.name}`, f, moved, (worst) => ({
          code: f === 0 ? "loop" : "jerky",
          severity: "error",
          title: f === 0 ? `${name} jumps where the rep loops` : `${name} pops between frames`,
          detail: `${worst.toFixed(0)}° in one frame`,
        }));
      } else if (speed > LIMITS.speed) {
        collector.add(`speed:${joint.name}`, f, speed, (worst) => ({
          code: "too-fast",
          severity: "warning",
          title: `${name} moves faster than a controlled rep`,
          detail: `${worst.toFixed(0)}°/s`,
        }));
      }
      const acceleration = Math.hypot(...after.map((value, n) => value - before[n])) / (dt * dt);
      if (acceleration > LIMITS.acceleration && moved <= LIMITS.jump) {
        collector.add(`jerk:${joint.name}`, f, acceleration, (worst) => ({
          code: "jerky",
          severity: "warning",
          title: `${name} changes speed abruptly`,
          detail: `${worst.toFixed(0)}°/s² of angular acceleration`,
        }));
      }
    }
  }

  if ((sequence.laterality ?? "bilateral") === "bilateral") {
    for (let f = 0; f < count; f++) {
      const a = kin.angles[f];
      for (const key of Object.keys(a)) {
        if (!key.includes("_L.")) continue;
        const difference = Math.abs(deg(a[key] - a[key.replace("_L.", "_R.")]));
        // Arm direction is ill-defined while the arm hangs, so it isn't compared there.
        if (
          key.endsWith(".plane") ||
          (key.endsWith(".twist") && a[key.replace(".twist", ".elev")] < 0.3)
        )
          continue;
        if (difference > LIMITS.asymmetry) {
          collector.add(`asym:${key}`, f, difference, (worst) => ({
            code: "asymmetric",
            severity: "warning",
            title: `Left and right ${pretty(key.split(".")[0].replace("_L", ""))} differ`,
            detail: `${key.split(".")[1]} is ${worst.toFixed(0)}° apart in a two-sided lift`,
          }));
        }
      }
    }
  }
  return collector.issues();
}

/** What a given weight makes of the motion: balance lost, a joint asked for more than its muscles have, a tendon overloaded. */
export interface ListedMuscles {
  primary: Muscle[];
  secondary: Muscle[];
}

/**
 * How many separate times a muscle's effort rises and falls through the looping rep. A controlled rep works a
 * muscle in one swell on the way down and one on the way up, so more than that is a pose or a load popping.
 */
function bursts(series: number[], prominence: number) {
  const count = series.length;
  const start = series.indexOf(Math.min(...series));
  let found = 0;
  let low = series[start];
  let high = low;
  let rising = true;
  for (let step = 1; step <= count; step++) {
    const value = series[(start + step) % count];
    if (rising) {
      if (value > high) high = value;
      else if (high - value >= prominence && high - low >= prominence) {
        found++;
        rising = false;
        low = value;
      }
    } else if (value < low) low = value;
    else if (value - low >= prominence) {
      rising = true;
      high = value;
    }
  }
  return found;
}

/**
 * Everything about a rep that depends on the weight: balance, strength, stretch, and whether the muscles it loads
 * are the ones the exercise is for. `listed` is what the catalog says the exercise works.
 */
export function validateLoad(sequence: Sequence, analysis: Analysis, listed?: ListedMuscles): Issue[] {
  const count = sequence.poses.length;
  const collector = new Collector(count);
  const moving = Math.max(2, sequence.phases.filter((phase) => phase.name === "lower" || phase.name === "raise").length);
  const peaks = MUSCLES.map((_, m) => analysis.peak[MUSCLES[m]].activation);
  MUSCLES.forEach((muscle, m) => {
    if (peaks[m] < LIMITS.burstFloor) return;
    for (const side of [0, 1]) {
      const series = analysis.activation.map((row) => row[m * 2 + side]);
      const found = bursts(series, Math.max(LIMITS.burstFloor / 2, LIMITS.burst * peaks[m]));
      if (found <= moving) continue;
      const top = series.indexOf(Math.max(...series));
      collector.add(`flicker:${muscle}`, top, found, (worst) => ({
        code: "muscle-flicker",
        severity: "error",
        title: `${MUSCLE_NAMES[muscle]} switch on and off ${worst} times in one rep`,
        detail: `a controlled rep loads a muscle once on the way down and once on the way up; look for a joint that pops, a hand or foot that shifts, or a load that changes direction`,
      }));
    }
  });
  if (listed && listed.primary.length > 0) {
    const named = new Set([...listed.primary, ...listed.secondary]);
    const hardest = Math.max(...peaks);
    const listedTop = Math.max(...[...named].map((muscle) => analysis.peak[muscle].activation));
    MUSCLES.forEach((muscle, m) => {
      const peak = peaks[m];
      const top = analysis.activation.findIndex((row) => Math.max(row[m * 2], row[m * 2 + 1]) >= peak - 1e-6);
      if (!named.has(muscle) && peak > LIMITS.burstFloor * 2 && peak > LIMITS.unlistedShare * listedTop) {
        collector.add(`unlisted:${muscle}`, Math.max(0, top), peak, (worst) => ({
          code: "muscle-mismatch",
          severity: "warning",
          title: `${MUSCLE_NAMES[muscle]} work harder than this exercise should ask`,
          detail: `${(worst * 100).toFixed(0)}% at peak against ${(listedTop * 100).toFixed(0)}% for the hardest-working muscle the exercise lists; usually a limb held off the line of the load`,
        }));
      }
      if (listed.primary.includes(muscle) && peak < LIMITS.primaryShare * hardest) {
        collector.add(`idle:${muscle}`, Math.max(0, top), hardest - peak, () => ({
          code: "muscle-mismatch",
          severity: "warning",
          title: `${MUSCLE_NAMES[muscle]} barely work in an exercise that lists them first`,
          detail: `${(peak * 100).toFixed(0)}% at peak while the hardest-working muscle reaches ${(hardest * 100).toFixed(0)}%`,
        }));
      }
    });
  }
  for (let f = 0; f < count; f++) {
    const support = analysis.support[f];
    if (support && !sequence.support.rail && support.margin < LIMITS.balanceMargin) {
      collector.add("balance", f, -support.margin, (worst) => ({
        code: "off-balance",
        severity: worst > 0 ? "error" : "warning",
        title:
          worst > 0
            ? "Centre of pressure leaves the feet"
            : "Balanced on the very edge of the feet",
        detail:
          worst > 0
            ? `${cm(worst)} outside the base of support, so the lifter would tip`
            : `${cm(-worst)} from the edge of the base of support`,
      }));
    }
    for (const { dof, fraction } of analysis.unmet[f]) {
      if (fraction <= LIMITS.overload) continue;
      collector.add(`overload:${dof}`, f, fraction, (worst) => ({
        code: "overload",
        severity: "error",
        title: `${pretty(dof.split(".")[0])} needs more than the lifter has`,
        detail: `${dof.includes(".") ? dof.split(".")[1] : "grip"} torque falls ${(worst * 100).toFixed(0)}% of capacity short at ${analysis.loadKg} kg`,
      }));
    }
    MUSCLES.forEach((muscle, m) => {
      SIDES.forEach((side, n) => {
        const stretch = analysis.stretch[f][m * 2 + n];
        if (stretch > LIMITS.stretch) {
          collector.add(`stretch:${muscle}`, f, stretch, (worst) => ({
            code: "overstretch",
            severity: "error",
            title: `${MUSCLE_NAMES[muscle]} stretched past end range`,
            detail: `${(worst * 100).toFixed(0)}% of its passive range`,
          }));
        }
        const load = analysis.tendon[f][m * 2 + n];
        if (load > LIMITS.tendonLoad) {
          collector.add(`tendon:${muscle}`, f, load, (worst) => ({
            code: "overstretch",
            severity: "warning",
            title: `${TENDONS[muscle]} loaded past the muscle's peak force`,
            detail: `${(worst * 100).toFixed(0)}% of peak, from a hard contraction at long length`,
          }));
        }
      });
    });
  }
  return collector.issues();
}

export function runChecks(
  body: Body,
  built: Built,
  sequence: Sequence,
  kin: Kinematics,
): CheckResult[] {
  const context = {
    body,
    sequence,
    frames: kin.frames,
    angles: kin.angles,
    top: 0,
    bottom: sequence.phases[1].from,
  };
  return built.checks.map((check) => ({
    id: check.id,
    label: check.label,
    cue: check.cue,
    ...check.evaluate(context),
  }));
}
