import { Quaternion, Vector3 } from "three";
import { SIDES, sideSign, worldPoint, type Angles, type Body, type Frame } from "./body";
import type { Kinematics, Sequence } from "./exercise";
import { clamp } from "./math";
import {
  createActuators,
  MUSCLES,
  passiveForce,
  stretchOf,
  TENDON_STRAIN_AT_PEAK,
  type Muscle,
} from "./muscles";

const G = 9.81;
/** Ligaments and the ribcage carry part of a hanging arm's weight before the upper traps have to. */
const PASSIVE_SHOULDER_SUSPENSION = 0.4;
const REGULARIZATION = 0.01;
/**
 * Motions that deep muscles this model leaves out and the joint itself largely hold (the hip's short rotators,
 * the spine's facets). Their torque counts for less, so a small twisting load can't max out a prime mover.
 */
const SECONDARY_MOTION = /\.(rot|twist|dev|pron)$/;
const SECONDARY_WEIGHT = 0.15;

interface Force {
  joint: number;
  point: Vector3;
  force: Vector3;
  /** A pure twisting moment, such as the floor's grip on a planted foot. */
  moment?: Vector3;
}

export interface FrameSupport {
  /** Centre of pressure on the floor, and how far inside the feet's outline it sits (negative when outside). */
  cop: [number, number];
  margin: number;
  /** Horizontal force the rails put on the bar, positive toward the front. */
  rail: number;
}

export interface Analysis {
  loadKg: number;
  /** Per frame, per muscle in `MUSCLES` order: the left side, then the right. 0 is relaxed, 1 is everything it has. */
  activation: Float32Array[];
  stretch: Float32Array[];
  /** Tendon load as a fraction of the muscle's peak force: active pull plus the passive tension of a stretch. */
  tendon: Float32Array[];
  peak: Record<
    Muscle,
    { activation: number; stretch: number; tendon: number; strainPercent: number }
  >;
  support: (FrameSupport | null)[];
  /** Per frame, the joint motions whose torque the modelled muscles could not meet, as a fraction of their capacity. */
  unmet: { dof: string; fraction: number }[][];
  demands: Record<string, number>[];
}

const ACTUATORS = createActuators();

function accelerations(points: Vector3[][], fps: number) {
  const frames = points.length;
  const raw = points.map((row, f) =>
    row.map((point, i) => {
      const before = points[(f - 1 + frames) % frames][i];
      const after = points[(f + 1) % frames][i];
      return new Vector3()
        .addVectors(before, after)
        .addScaledVector(point, -2)
        .multiplyScalar(fps * fps);
    }),
  );
  // The pose spline is only smooth to its first derivative, so the raw second difference rings at its knots.
  return raw.map((row, f) =>
    row.map((_, i) => {
      const sum = new Vector3();
      for (let k = -3; k <= 3; k++) sum.add(raw[(f + k + frames) % frames][i]);
      return sum.divideScalar(7);
    }),
  );
}

/**
 * The torque every joint has to hold through the rep under a given weight, shared out among the muscle groups
 * that can produce it, with how far each muscle-tendon unit is lengthened. Quasi-static inverse dynamics: gravity
 * plus each mass's linear acceleration, no rotational inertia.
 */
export function analyze(
  body: Body,
  sequence: Sequence,
  kin: Kinematics,
  loadKg = sequence.loadKg,
): Analysis {
  const frames = kin.frames.length;
  const ancestors = body.joints.map((joint) => {
    const chain: number[] = [];
    for (let j = joint.index; j > 0; j = body.joints[j].parent) chain.push(j);
    return chain;
  });
  const anchors = sequence.loads.map((load) => body.anchors[load.anchor]);
  const masses = [
    ...body.segments.map((segment) => segment.mass),
    ...sequence.loads.map((load) => load.share * loadKg),
  ];
  const points = kin.frames.map((frame) => [
    ...body.segments.map((segment) => worldPoint(frame, segment.joint, segment.com)),
    ...anchors.map((anchor) => worldPoint(frame, anchor.joint, anchor.local)),
  ]);
  const joints = [
    ...body.segments.map((segment) => segment.joint),
    ...anchors.map((anchor) => anchor.joint),
  ];
  const accel = accelerations(points, sequence.fps);
  const passive = new Set(sequence.support.passive ?? []);
  const isPassive = (name: string) => passive.has(name) || passive.has(name.replace(/_[LR]$/, ""));

  const dofIndex = new Map<string, number>();
  const dofScale: number[] = [];
  const columns = ACTUATORS.map((actuator) =>
    actuator.entries.map((entry) => {
      if (!dofIndex.has(entry.dof)) {
        dofIndex.set(entry.dof, dofScale.length);
        dofScale.push(0);
      }
      const index = dofIndex.get(entry.dof)!;
      dofScale[index] = Math.max(
        dofScale[index],
        Math.abs(entry.capacity) < 2 ? 60 : Math.abs(entry.capacity),
      );
      return { index, entry };
    }),
  );
  const dofNames = [...dofIndex.keys()];
  const dofWeight = dofNames.map(
    (name, i) => (SECONDARY_MOTION.test(name) ? SECONDARY_WEIGHT : 1) / dofScale[i] ** 2,
  );

  const activation: Float32Array[] = [];
  const stretch: Float32Array[] = [];
  const tendon: Float32Array[] = [];
  const support: (FrameSupport | null)[] = [];
  const unmet: { dof: string; fraction: number }[][] = [];
  const demandsOut: Record<string, number>[] = [];
  const levels = new Float64Array(ACTUATORS.length);
  const torque = body.joints.map(() => new Vector3());
  const arm = new Vector3();
  const moment = new Vector3();
  const axis = new Vector3();
  const inverse = new Quaternion();
  const local = new Vector3();

  for (let f = 0; f < frames; f++) {
    const frame = kin.frames[f];
    const a = kin.angles[f];
    const forces: Force[] = masses.map((mass, i) => ({
      joint: joints[i],
      point: points[f][i],
      force: new Vector3(-accel[f][i].x, -G - accel[f][i].y, -accel[f][i].z).multiplyScalar(mass),
    }));

    if (sequence.support.kind === "standing") {
      support.push(standOn(body, frame, forces, sequence, points[f][body.segments.length]));
    } else {
      support.push(null);
    }

    for (const t of torque) t.set(0, 0, 0);
    for (const force of forces) {
      for (const j of ancestors[force.joint]) {
        moment.crossVectors(arm.subVectors(force.point, frame.pos[j]), force.force);
        torque[j].sub(moment);
        if (force.moment) torque[j].sub(force.moment);
      }
    }

    const demand = new Float64Array(dofNames.length);
    const set = (dof: string, value: number) => {
      const index = dofIndex.get(dof);
      if (index !== undefined) demand[index] = value;
    };
    for (const joint of body.joints) {
      if (joint.kind === "root" || isPassive(joint.name)) continue;
      const t = torque[joint.index];
      if (joint.kind === "ball") {
        const s = joint.side ? sideSign(joint.side) : 1;
        if (joint.name.startsWith("hip")) {
          local.copy(t).applyQuaternion(inverse.copy(frame.rot[joint.index]).invert());
          set(`${joint.name}.flex`, -local.x);
          set(`${joint.name}.abd`, s * local.z);
          set(`${joint.name}.rot`, s * local.y);
        } else if (joint.name.startsWith("shoulder")) {
          local.copy(t).applyQuaternion(inverse.copy(frame.rot[body.index.thoracic]).invert());
          set(`${joint.name}.flex`, -local.x);
          set(`${joint.name}.abd`, s * local.z);
          set(`${joint.name}.hadd`, -s * local.y);
        } else {
          local.copy(t).applyQuaternion(inverse.copy(frame.rot[joint.parent]).invert());
          set(`${joint.name}.flex`, local.x);
          set(`${joint.name}.bend`, -local.z);
          set(`${joint.name}.twist`, local.y);
        }
        continue;
      }
      joint.dofs.forEach((dof, n) => {
        axis
          .set(dof.axis[0], dof.axis[1], dof.axis[2])
          .applyQuaternion(frame.rot[n === 0 ? joint.parent : joint.index]);
        let value = dof.sign * t.dot(axis);
        if (joint.name.startsWith("clavicle") && dof.name === "elev")
          value *= 1 - PASSIVE_SHOULDER_SUSPENSION;
        set(`${joint.name}.${dof.name}`, value);
      });
    }
    sequence.loads.forEach((load, i) => {
      const side = load.anchor.endsWith("_L") ? "L" : load.anchor.endsWith("_R") ? "R" : null;
      if (!side || load.grip === "rest") return;
      const pull = forces[body.segments.length + i].force.length();
      set(`grip_${side}`, load.grip === "hang" ? pull : 0.2 * pull);
    });

    solveActivations(columns, a, demand, dofWeight, levels);

    const residual = Float64Array.from(demand, (value) => -value);
    columns.forEach((column, i) => {
      for (const { index, entry } of column)
        residual[index] += levels[i] * entry.capacity * (entry.scale?.(a) ?? 1);
    });
    const short: { dof: string; fraction: number }[] = [];
    residual.forEach((value, i) => {
      const fraction = Math.abs(value) / dofScale[i];
      if (fraction > 0.06 && !SECONDARY_MOTION.test(dofNames[i]))
        short.push({ dof: dofNames[i], fraction });
    });
    unmet.push(short);
    demandsOut.push(Object.fromEntries(dofNames.map((name, i) => [name, demand[i]])));

    const act = new Float32Array(MUSCLES.length * 2);
    ACTUATORS.forEach((actuator, i) => {
      const slot = MUSCLES.indexOf(actuator.muscle) * 2 + (actuator.side === "L" ? 0 : 1);
      act[slot] = Math.max(act[slot], levels[i]);
    });
    const str = new Float32Array(MUSCLES.length * 2);
    const ten = new Float32Array(MUSCLES.length * 2);
    MUSCLES.forEach((muscle, m) => {
      SIDES.forEach((side, n) => {
        str[m * 2 + n] = stretchOf(muscle, a, side);
        ten[m * 2 + n] = act[m * 2 + n] + passiveForce(str[m * 2 + n]);
      });
    });
    activation.push(act);
    stretch.push(str);
    tendon.push(ten);
  }

  const peak = {} as Analysis["peak"];
  MUSCLES.forEach((muscle, m) => {
    const top = (rows: Float32Array[]) =>
      Math.max(...rows.map((row) => Math.max(row[m * 2], row[m * 2 + 1])));
    peak[muscle] = {
      activation: top(activation),
      stretch: top(stretch),
      tendon: top(tendon),
      strainPercent: top(tendon) * TENDON_STRAIN_AT_PEAK,
    };
  });
  return { loadKg, activation, stretch, tendon, peak, support, unmet, demands: demandsOut };
}

type Column = { index: number; entry: { capacity: number; scale?: (angles: Angles) => number } }[];

/**
 * Static optimisation: the activations in [0, 1] that meet every joint's torque demand with the least total
 * squared activation, by coordinate descent. `levels` carries the previous frame's answer in and this one's out.
 */
function solveActivations(
  columns: Column[],
  angles: Angles,
  demand: Float64Array,
  weight: number[],
  levels: Float64Array,
) {
  const capacity = columns.map((column) =>
    column.map(({ entry }) => entry.capacity * (entry.scale?.(angles) ?? 1)),
  );
  const residual = Float64Array.from(demand, (value) => -value);
  columns.forEach((column, i) =>
    column.forEach(({ index }, k) => (residual[index] += levels[i] * capacity[i][k])),
  );
  const curvature = columns.map((column, i) =>
    column.reduce((sum, { index }, k) => sum + weight[index] * capacity[i][k] ** 2, REGULARIZATION),
  );
  for (let sweep = 0; sweep < 3000; sweep++) {
    let moved = 0;
    for (let i = 0; i < columns.length; i++) {
      let gradient = REGULARIZATION * levels[i];
      columns[i].forEach(
        ({ index }, k) => (gradient += weight[index] * capacity[i][k] * residual[index]),
      );
      const next = clamp(levels[i] - gradient / curvature[i], 0, 1);
      const delta = next - levels[i];
      if (delta === 0) continue;
      levels[i] = next;
      columns[i].forEach(({ index }, k) => (residual[index] += delta * capacity[i][k]));
      moved = Math.max(moved, Math.abs(delta));
    }
    if (moved < 1e-6) break;
  }
}

/**
 * Adds the floor's push on each foot, which is what loads the legs. A free-standing lifter's centre of pressure
 * falls where the moments balance. On rails it stays under the middle of the feet and the rails take the difference.
 */
function standOn(
  body: Body,
  frame: Frame,
  forces: Force[],
  sequence: Sequence,
  barPoint: Vector3,
): FrameSupport {
  const total = new Vector3();
  const momentSum = new Vector3();
  const m = new Vector3();
  for (const { point, force } of forces) {
    total.add(force);
    momentSum.add(m.crossVectors(point, force));
  }
  const feet = SIDES.map((side) => {
    const heel = worldPoint(
      frame,
      body.anchors[`heel_${side}`].joint,
      body.anchors[`heel_${side}`].local,
    );
    const toe = worldPoint(
      frame,
      body.anchors[`toe_${side}`].joint,
      body.anchors[`toe_${side}`].local,
    );
    return { side, heel, toe, x: (heel.x + toe.x) / 2 };
  });
  const zBack = Math.min(...feet.map((foot) => foot.heel.z)) - 0.02;
  const zFront = Math.max(...feet.map((foot) => foot.toe.z));
  const xLeft = feet[0].x + 0.05;
  const xRight = feet[1].x - 0.05;
  const up = -total.y;
  let rail = 0;
  let copZ = momentSum.x / up;
  const copX = -momentSum.z / up;
  if (sequence.support.rail) {
    // The lifter keeps the pressure under the middle of the feet and the rails take whatever balance is left
    // over, so this solves the fore-aft moment balance for the rail's force instead of the centre of pressure.
    const length = zFront - zBack;
    const midfoot = clamp(copZ, zBack + 0.35 * length, zBack + 0.65 * length);
    rail = (up * (midfoot - copZ)) / barPoint.y;
    const anchor = body.anchors[sequence.loads[0].anchor];
    forces.push({ joint: anchor.joint, point: barPoint.clone(), force: new Vector3(0, 0, rail) });
    total.z += rail;
    copZ = midfoot;
  }
  const margin = Math.min(copZ - zBack, zFront - copZ, xLeft - copX, copX - xRight);
  const z = clamp(copZ, zBack, zFront);
  const leftShare = clamp((copX - feet[1].x) / (feet[0].x - feet[1].x), 0, 1);
  const pushes = feet.map((foot, i) => ({
    joint: body.index[`ankle_${foot.side}`],
    point: new Vector3(foot.x, 0, clamp(z, foot.heel.z, foot.toe.z)),
    force: total.clone().multiplyScalar(-(i === 0 ? leftShare : 1 - leftShare)),
    moment: new Vector3(),
  }));
  forces.push(...pushes);
  if (leftShare > 0.2 && leftShare < 0.8) settleFriction(body, frame, forces, pushes);
  return { cop: [copX, copZ], margin, rail };
}

/**
 * With both feet down, friction lets them push sideways and twist against each other. Those pairs cancel, so
 * statics leaves them free, and a lifter settles where the hips don't fight the floor: this picks the pair that
 * leaves the least sideways and twisting torque at the hips, inside what friction can hold.
 */
function settleFriction(
  body: Body,
  frame: Frame,
  forces: Force[],
  pushes: { joint: number; point: Vector3; force: Vector3; moment: Vector3 }[],
) {
  const inverse = new Quaternion();
  const arm = new Vector3();
  const v = new Vector3();
  // Rows: each hip's abduction and rotation torque. Columns: the sideways force and the twist on the left foot,
  // mirrored on the right.
  let a00 = 0;
  let a01 = 0;
  let a11 = 0;
  let b0 = 0;
  let b1 = 0;
  pushes.forEach((push, i) => {
    const hip = body.index[`hip_${i === 0 ? "L" : "R"}`];
    const mirror = i === 0 ? 1 : -1;
    inverse.copy(frame.rot[hip]).invert();
    const torque = new Vector3();
    for (const force of forces) {
      let j = force.joint;
      while (j > 0 && j !== hip) j = body.joints[j].parent;
      if (j === hip)
        torque.sub(v.crossVectors(arm.subVectors(force.point, frame.pos[hip]), force.force));
    }
    torque.applyQuaternion(inverse);
    const perForce = v
      .crossVectors(arm.subVectors(push.point, frame.pos[hip]), new Vector3(mirror, 0, 0))
      .negate()
      .applyQuaternion(inverse)
      .clone();
    const perTwist = new Vector3(0, -mirror, 0).applyQuaternion(inverse);
    for (const axis of ["y", "z"] as const) {
      a00 += perForce[axis] ** 2;
      a01 += perForce[axis] * perTwist[axis];
      a11 += perTwist[axis] ** 2;
      b0 -= perForce[axis] * torque[axis];
      b1 -= perTwist[axis] * torque[axis];
    }
  });
  const det = a00 * a11 - a01 * a01;
  if (Math.abs(det) < 1e-9) return;
  pushes.forEach((push, i) => {
    const mirror = i === 0 ? 1 : -1;
    const grip = Math.abs(push.force.y);
    push.force.x += mirror * clamp((b0 * a11 - b1 * a01) / det, -0.4 * grip, 0.4 * grip);
    push.moment.y = mirror * clamp((a00 * b1 - a01 * b0) / det, -0.03 * grip, 0.03 * grip);
  });
}
