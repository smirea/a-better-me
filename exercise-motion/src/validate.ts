import { Vector3 } from "three";
import { anchorPoint, selfCollisionPairs, SIDES, type Body } from "./body";
import type { Analysis } from "./biomech";
import { compileParts, propParts, signedDistance, type Shape } from "./equipment";
import type { Built, CheckResult, Kinematics, Sequence } from "./exercise";
import { deg, quatFromRotVec, rotVecFromQuat } from "./math";
import { MUSCLE_NAMES, MUSCLES, TENDONS } from "./muscles";
import {
  capsulePenetration,
  capsulesInWorld,
  limitViolations,
  newCapsules,
  obstaclePenetration,
} from "./solver";

export interface Issue {
  code:
    | "joint-limit"
    | "self-collision"
    | "equipment-clip"
    | "floor"
    | "contact-lost"
    | "contact-slides"
    | "too-fast"
    | "jerky"
    | "asymmetric"
    | "loop"
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
  clip: 0.004,
  contactGap: 0.012,
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
  const allowance = (partId: string, colliderId: string) => {
    for (const [prefix, allowed] of Object.entries(sequence.contacts)) {
      if (partId.startsWith(prefix) && allowed[colliderId] !== undefined)
        return allowed[colliderId];
    }
    return 0;
  };
  const visible = body.colliders
    .map((collider, i) => (collider.visible ? i : -1))
    .filter((i) => i >= 0);
  const slides = new Map<string, { min: Vector3; max: Vector3 }>();

  for (let f = 0; f < count; f++) {
    const frame = kin.frames[f];
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
        const id = body.colliders[i].id;
        const depth = obstaclePenetration(body, capsules, i, shape) - allowance(shape.part.id, id);
        if (depth <= LIMITS.clip) continue;
        collector.add(`clip:${id}:${shape.part.id}`, f, depth, (worst) => ({
          code: "equipment-clip",
          severity: worst > 0.02 ? "error" : "warning",
          title: `${pretty(id)} clips through ${shape.part.id.split(".").map(pretty).join(" ")}`,
          detail: `${cm(worst)} inside it`,
        }));
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
        const partShape = allEquipmentById.get(contact.part);
        if (!partShape) {
          throw new Error(`Required contact "${contact.label}" references missing part "${contact.part}"`);
        }
        gap = Math.max(0, signedDistance(partShape, point));
        if (!contact.allowSlide) {
          const seen = slides.get(contact.label) ?? { min: point.clone(), max: point.clone() };
          seen.min.min(point);
          seen.max.max(point);
          slides.set(contact.label, seen);
        }
      } else {
        const p = sequence.props.findIndex((prop) => prop.id === contact.prop);
        if (p < 0) {
          throw new Error(`Required contact "${contact.label}" references missing prop "${contact.prop}"`);
        }
        const handle = compileParts(
          propParts(sequence.props[p], sequence.loadKg).slice(0, 1),
          sequence.propStates[f][p],
        )[0];
        gap = Math.max(0, signedDistance(handle, point));
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
export function validateLoad(sequence: Sequence, analysis: Analysis): Issue[] {
  const count = sequence.poses.length;
  const collector = new Collector(count);
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
