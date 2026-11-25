import { Quaternion, Vector3 } from "three";
import { SIDES, sideSign, worldPoint, type Anchor, type Body } from "./body";
import { footContact, type Contact, type Kinematics, type Sequence } from "./exercise";
import { solveBounded, type SparseColumn } from "./least-squares";
import { clamp, rotVecFromQuat, type Vec3 } from "./math";
import {
  createActuators,
  MUSCLES,
  passiveForce,
  speedFactor,
  stretchOf,
  TENDON_STRAIN_AT_PEAK,
  type Muscle,
} from "./muscles";

const G = 9.81;
/** Ligaments and the ribcage carry part of a hanging arm's weight before the upper traps have to. */
const PASSIVE_SHOULDER_SUSPENSION = 0.4;
/** What a unit of squared activation costs against a joint torque missed by the whole of a joint's capacity. */
const EFFORT = 0.01;
/**
 * Motions that deep muscles this model leaves out and the joint itself largely hold (the hip's short rotators,
 * the spine's facets). Their torque counts for less, so a small twisting load can't max out a prime mover.
 */
const SECONDARY_MOTION = /\.(rot|twist|dev|pron)$/;
const SECONDARY_WEIGHT = 0.15;
/**
 * Muscles don't switch off when their joint's net torque points the other way: the antagonists stiffen the joint
 * with a pull that is a roughly fixed share of the net torque, whatever their own size. Hamstrings give back about
 * 30 N·m of a maximal knee extension (Aagaard et al., 2000), and the abdominal wall of a braced squat runs at a
 * tenth to a quarter of its maximum while the back extensors run near theirs (Aspe & Swinton, 2014).
 */
const COCONTRACTION = 0.1;
/** The share of a surface's push that friction can turn sideways before a shoe or a palm slides on it. */
const FRICTION = 0.5;
/** A contact point this far off its surface, in metres, carries everything it could; `LIFTED` and beyond, nothing. */
const TOUCHING = 0.01;
const LIFTED = 0.03;
/** The most one contact point pushes, in bodyweights. */
const REACH = 4;
/** What a miss on whole-body balance costs against a miss on a joint's torque. Balance is physics, not a preference. */
const BALANCE = 1e4;
/** The lever, in metres, that puts balance of moments on the same scale as balance of forces. */
const LEVER = 0.3;
/** The cost of a contact force's own square: only enough to pick the gentlest of pushes the muscles don't care between. */
const CONTACT_RIDGE = 1e-4;
/** Activation rises over about 15 ms and decays over about 60 ms (Thelen, 2003; De Groote et al., 2016). */
const ACTIVATION_TIME = { rise: 0.015, fall: 0.06 };
/**
 * A straight elbow or knee rests on its stop: bone and ligament carry a load that would bend it backward, so a
 * locked-out arm or leg needs no muscle to stay straight. The stop takes everything within `LOCKED` of straight and
 * nothing beyond `UNLOCKED`, in radians, up to `STOP_TORQUE` N·m.
 */
const LOCKED = (3 * Math.PI) / 180;
const UNLOCKED = (12 * Math.PI) / 180;
const STOP_TORQUE = 150;
/** A fixed handle takes a fifth of a push through the palm to keep hold of, and all of a pull along the fingers. */
const PRESS_GRIP = 0.2;

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
  /** Per frame, what each contact point is pushed with, in newtons. */
  reactions: { anchor: string; force: Vec3 }[][];
}

const ACTUATORS = createActuators();

/** One joint motion a muscle can turn: the world direction its torque is read along, and what it turns against. */
interface Motion {
  row: number;
  joint: number;
  /** The joint whose frame carries the axis, and the axis in that frame. */
  frame: number;
  local: Vector3;
  /** The joint this one's turning is measured against. */
  reference: number;
  gain: number;
}

interface Push {
  anchor: string;
  point: Anchor;
  /** The other end of a bar, which is pushed the opposite way: together along the bar, or apart when `apart`. */
  counter?: Anchor;
  apart: boolean;
  /** The limb a held weight rests against, which is pushed back as hard as it pushes: its joint, length and reach. */
  limb?: { joint: number; length: number; within: number };
  column: number;
  /** Direction in the world for a surface, or in the hand's own frame for a handle. */
  direction: Vector3;
  local: boolean;
  /** The contact it belongs to, or -1 for the rails' push on a bar and a push along one. */
  contact: number;
  /** Which of the contact's anchors it acts on. */
  slot: number;
  grip: number;
  /** Where each joint motion this push turns sits in its column, for its own end and for the far end of a bar. */
  turns: { motion: Motion; at: number }[][];
  /** How many joint motions it turns, which is where the rest of its column starts. */
  width: number;
  /** Its push in the world this frame, in newtons at full strength. */
  world: Vector3;
}

/** The contacts that hold the body up when a spec lists none: the feet when standing, the hands when hanging. */
export function contactsOf(sequence: Sequence): Contact[] {
  const { support } = sequence;
  if (support.contacts) return support.contacts;
  if (support.kind === "standing")
    return (support.feet?.length ? support.feet : SIDES).map((side) => footContact(side));
  if (support.kind === "hanging")
    return SIDES.map((side) => ({ kind: "hold" as const, anchors: [`grip_${side}`] }));
  return [];
}

const carriesItself = (sequence: Sequence) =>
  sequence.support.kind === "standing" ||
  sequence.support.kind === "hanging" ||
  sequence.support.kind === "planted";

/** A running mean over the looping rep, a quarter of a second wide. */
function smoothed(raw: Vector3[][], passes = 1): Vector3[][] {
  const frames = raw.length;
  const out = raw.map((row, f) =>
    row.map((_, i) => {
      const sum = new Vector3();
      for (let k = -3; k <= 3; k++) sum.add(raw[(f + k + frames) % frames][i]);
      return sum.divideScalar(7);
    }),
  );
  return passes > 1 ? smoothed(out, passes - 1) : out;
}

function accelerations(points: Vector3[][], fps: number) {
  const frames = points.length;
  // The pose spline is only smooth to its first derivative, so its second difference jumps at every knot, a few
  // frames apart. Left in, that noise moves a standing lifter's centre of pressure centimetres from frame to frame
  // and the calves and shins flicker to hold it. Three passes of the running mean come to a zero-lag low-pass near
  // 1 Hz, which keeps the accelerations of a rep that takes seconds and drops the knots.
  return smoothed(
    points.map((row, f) =>
      row.map((point, i) => {
        const before = points[(f - 1 + frames) % frames][i];
        const after = points[(f + 1) % frames][i];
        return new Vector3()
          .addVectors(before, after)
          .addScaledVector(point, -2)
          .multiplyScalar(fps * fps);
      }),
    ),
    3,
  );
}

/** Each joint's angular velocity in the world, in rad/s, through the looping rep. */
function spins(kin: Kinematics, fps: number) {
  const frames = kin.frames.length;
  const turn = new Quaternion();
  return smoothed(
    kin.frames.map((_, f) => {
      const before = kin.frames[(f - 1 + frames) % frames];
      const after = kin.frames[(f + 1) % frames];
      return after.rot.map((rot, j) => {
        const [x, y, z] = rotVecFromQuat(turn.copy(before.rot[j]).invert().premultiply(rot));
        return new Vector3(x, y, z).multiplyScalar(fps / 2);
      });
    }),
  );
}

function motionsOf(body: Body, rows: Map<string, number>, isPassive: (name: string) => boolean) {
  const motions: Motion[][] = body.joints.map(() => []);
  for (const joint of body.joints) {
    if (joint.kind === "root" || isPassive(joint.name)) continue;
    const add = (motion: string, frame: number, local: Vec3, reference: number, gain = 1) => {
      const row = rows.get(`${joint.name}.${motion}`);
      if (row === undefined) return;
      motions[joint.index].push({
        row,
        joint: joint.index,
        frame,
        local: new Vector3(local[0], local[1], local[2]),
        reference,
        gain,
      });
    };
    if (joint.kind === "ball") {
      const s = joint.side ? sideSign(joint.side) : 1;
      if (joint.name.startsWith("hip")) {
        add("flex", joint.index, [-1, 0, 0], joint.parent);
        add("abd", joint.index, [0, 0, s], joint.parent);
        add("rot", joint.index, [0, s, 0], joint.parent);
      } else if (joint.name.startsWith("shoulder")) {
        // Read against the thorax, not the moving collarbone, as the shoulder's angles are.
        add("flex", body.index.thoracic, [-1, 0, 0], body.index.thoracic);
        add("abd", body.index.thoracic, [0, 0, s], body.index.thoracic);
        add("hadd", body.index.thoracic, [0, -s, 0], body.index.thoracic);
      } else {
        add("flex", joint.parent, [1, 0, 0], joint.parent);
        add("bend", joint.parent, [0, 0, -1], joint.parent);
        add("twist", joint.parent, [0, 1, 0], joint.parent);
      }
      continue;
    }
    joint.dofs.forEach((dof, n) =>
      add(
        dof.name,
        n === 0 ? joint.parent : joint.index,
        [dof.sign * dof.axis[0], dof.sign * dof.axis[1], dof.sign * dof.axis[2]],
        joint.parent,
        joint.name.startsWith("clavicle") && dof.name === "elev" ? 1 - PASSIVE_SHOULDER_SUSPENSION : 1,
      ),
    );
  }
  return motions;
}

/**
 * The torque every joint has to hold through the rep under a given weight, shared out among the muscle groups
 * that can produce it, with how far each muscle-tendon unit is lengthened.
 *
 * Inverse dynamics gives each joint's torque from gravity, each mass's linear acceleration and the forces on the
 * body from outside. A weight or a cable is a known force. A surface or a handle the body pushes on is not: it
 * pushes back with whatever keeps the whole body in balance, and where balance leaves a choice (how hard the feet
 * press sideways, where under a foot or a palm the pressure sits, how two hands share a bar) the body takes the
 * one that costs its muscles least. So contact forces and muscle activations are solved together, as one least
 * effort problem (Fluit et al., 2014; Skals et al., 2017), with the squared activations of static optimisation
 * (Anderson & Pandy, 2001) as the effort.
 */
export function analyze(
  body: Body,
  sequence: Sequence,
  kin: Kinematics,
  loadKg = sequence.loadKg,
): Analysis {
  const frames = kin.frames.length;
  const weight = body.mass * G;
  const ancestors = body.joints.map((joint) => {
    const chain: number[] = [];
    for (let j = joint.index; j > 0; j = body.joints[j].parent) chain.push(j);
    return chain;
  });
  const loadAnchors = sequence.loads.map((load) => body.anchors[load.anchor]);
  const masses = [
    ...body.segments.map((segment) => segment.mass),
    ...sequence.loads.map((load) => load.share * loadKg),
  ];
  const points = kin.frames.map((frame) => [
    ...body.segments.map((segment) => worldPoint(frame, segment.joint, segment.com)),
    ...loadAnchors.map((anchor) => worldPoint(frame, anchor.joint, anchor.local)),
  ]);
  const joints = [
    ...body.segments.map((segment) => segment.joint),
    ...loadAnchors.map((anchor) => anchor.joint),
  ];
  const accel = accelerations(points, sequence.fps);
  const spin = spins(kin, sequence.fps);
  const passive = new Set(sequence.support.passive ?? []);
  const isPassive = (name: string) => passive.has(name) || passive.has(name.replace(/_[LR]$/, ""));

  const rowIndex = new Map<string, number>();
  for (const actuator of ACTUATORS)
    for (const entry of actuator.entries)
      if (!rowIndex.has(entry.dof)) rowIndex.set(entry.dof, rowIndex.size);
  const rowNames = [...rowIndex.keys()];
  const torqueRows = rowNames.length;
  const rowScale = new Float64Array(torqueRows);
  for (const actuator of ACTUATORS)
    for (const entry of actuator.entries) {
      const row = rowIndex.get(entry.dof)!;
      rowScale[row] = Math.max(rowScale[row], Math.abs(entry.capacity));
    }
  const secondary = rowNames.map((name) => SECONDARY_MOTION.test(name));
  const motions = motionsOf(body, rowIndex, isPassive);
  const held = new Uint8Array(torqueRows);
  for (const list of motions) for (const motion of list) held[motion.row] = 1;
  for (const side of SIDES) held[rowIndex.get(`grip_${side}`)!] = 1;

  const contacts = contactsOf(sequence);
  const free = carriesItself(sequence);
  const balanceRow = torqueRows;
  let rowCount = torqueRows + (free ? 6 : 0);
  const pressRow = contacts.map((contact) => (contact.share === undefined ? -1 : rowCount++));

  const pushes: Push[] = [];
  const addPush = (
    anchor: string,
    direction: Vector3,
    contact: number,
    slot: number,
    local = false,
    grip = 0,
    counter?: string,
    apart = false,
  ) =>
    pushes.push({
      anchor,
      point: body.anchors[anchor],
      counter: counter ? body.anchors[counter] : undefined,
      apart,
      column: ACTUATORS.length + pushes.length,
      direction,
      local,
      contact,
      slot,
      grip,
      turns: [],
      width: 0,
      world: new Vector3(),
    }) - 1;
  const normals = contacts.map(
    (contact) => new Vector3(...(contact.normal ?? [0, 1, 0])).normalize(),
  );
  contacts.forEach((contact, c) => {
    contact.anchors.forEach((anchor, slot) => {
      if (contact.kind === "hold") {
        // A handle pushes any way: along the hand toward the fingers, which the grip has to hold, back toward the
        // wrist, across the palm either way, and along the bar either way.
        for (const [x, y, z, grip] of [
          [0, -1, 0, 1],
          [0, 1, 0, PRESS_GRIP],
          [1, 0, 0, PRESS_GRIP],
          [-1, 0, 0, PRESS_GRIP],
          [0, 0, 1, PRESS_GRIP],
          [0, 0, -1, PRESS_GRIP],
        ])
          addPush(anchor, new Vector3(x, y, z), c, slot, true, grip);
        return;
      }
      // A surface pushes along its normal and grips by friction, so its push stays inside a cone about the normal:
      // any mix of these four edges of that cone.
      const normal = normals[c];
      const across = new Vector3(1, 0, 0);
      if (Math.abs(normal.x) > 0.9) across.set(0, 0, 1);
      across.addScaledVector(normal, -across.dot(normal)).normalize();
      const along = new Vector3().crossVectors(normal, across);
      for (const tangent of [across, along])
        for (const sign of [1, -1])
          addPush(anchor, normal.clone().addScaledVector(tangent, sign * FRICTION), c, slot);
    });
  });
  if (free && sequence.support.rail && sequence.loads.length > 0)
    for (const sign of [1, -1]) addPush(sequence.loads[0].anchor, new Vector3(0, 0, sign), -1, 0);
  for (const lean of sequence.support.leans ?? []) {
    const joint = body.index[lean.on];
    const below = body.joints.find((other) => other.parent === joint);
    pushes[addPush(lean.anchor, new Vector3(), -1, 0)].limb = {
      joint,
      length: below ? below.offset.length() : 0.3,
      within: lean.within,
    };
  }
  for (const [a, b] of sequence.support.bars ?? []) {
    addPush(a, new Vector3(), -1, 0, false, 0, b);
    addPush(a, new Vector3(), -1, 0, false, 0, b, true);
  }

  const stops = SIDES.flatMap((side) =>
    ["elbow", "knee"].flatMap((joint) => {
      const angle = `${joint}_${side}.flex`;
      const row = rowIndex.get(angle)!;
      return held[row] ? [{ angle, row }] : [];
    }),
  );
  const firstStop = ACTUATORS.length + pushes.length;
  const n = firstStop + stops.length;
  const columns: SparseColumn[] = [];
  for (const actuator of ACTUATORS) {
    const rows = Int32Array.from(actuator.entries, (entry) => rowIndex.get(entry.dof)!);
    columns.push({ rows, values: new Float64Array(rows.length) });
  }
  const peakCapacity = ACTUATORS.map((actuator) =>
    Math.max(...actuator.entries.map((entry) => Math.abs(entry.capacity))),
  );
  for (const push of pushes) {
    const rows: number[] = [];
    const ends = [push.point.joint];
    if (push.counter) ends.push(push.counter.joint);
    if (push.limb) ends.push(push.limb.joint);
    for (const end of ends)
      push.turns.push(
        ancestors[end].flatMap((j) =>
          motions[j].map((motion) => {
            let at = rows.indexOf(motion.row);
            if (at < 0) at = rows.push(motion.row) - 1;
            return { motion, at };
          }),
        ),
      );
    push.width = rows.length;
    // Equal and opposite pushes between two parts of the body add up to nothing on the body as a whole.
    if (free && ends.length === 1) for (let i = 0; i < 6; i++) rows.push(balanceRow + i);
    if (push.contact >= 0 && pressRow[push.contact] >= 0) rows.push(pressRow[push.contact]);
    if (push.grip > 0) {
      const side = push.anchor.endsWith("_L") ? "L" : push.anchor.endsWith("_R") ? "R" : null;
      if (side) rows.push(rowIndex.get(`grip_${side}`)!);
    }
    columns.push({ rows: Int32Array.from(rows), values: new Float64Array(rows.length) });
  }
  for (const stop of stops)
    columns.push({ rows: Int32Array.of(stop.row), values: Float64Array.of(STOP_TORQUE) });
  const opposers: { actuator: number; entry: number }[][] = rowNames.map(() => []);
  ACTUATORS.forEach((actuator, i) =>
    actuator.entries.forEach((entry, e) => opposers[rowIndex.get(entry.dof)!].push({ actuator: i, entry: e })),
  );

  const target = new Float64Array(rowCount);
  const rowWeight = new Float64Array(rowCount);
  for (let row = 0; row < torqueRows; row++)
    rowWeight[row] = held[row] ? (secondary[row] ? SECONDARY_WEIGHT : 1) / rowScale[row] ** 2 : 0;
  for (let row = torqueRows; row < rowCount; row++) rowWeight[row] = BALANCE;
  const ridge = new Float64Array(n).fill(CONTACT_RIDGE);
  ridge.fill(EFFORT, 0, ACTUATORS.length);
  const lo = new Float64Array(n);
  const hi = new Float64Array(n).fill(1);
  const x = new Float64Array(n);
  const state = new Int8Array(n).fill(-1);
  const problem = { columns, target, weight: rowWeight, ridge, lo, hi };

  const activation: Float32Array[] = [];
  const stretch: Float32Array[] = [];
  const tendon: Float32Array[] = [];
  const support: (FrameSupport | null)[] = [];
  const unmet: { dof: string; fraction: number }[][] = [];
  const demandsOut: Record<string, number>[] = [];
  const reactions: { anchor: string; force: Vec3 }[][] = [];

  const axes = rowNames.map(() => new Vector3());
  const rate = new Float64Array(torqueRows);
  const known = new Float64Array(torqueRows);
  const demand = new Float64Array(torqueRows);
  const arm = new Vector3();
  const moment = new Vector3();
  const force = new Vector3();
  const net = new Vector3();
  const netMoment = new Vector3();
  const point = new Vector3();
  const far = new Vector3();
  const direction = new Vector3();
  // What each hand carries, in bodyweights: the most its grip can add along a bar, or a limb can push back on a
  // weight resting against it, is a share of that.
  const barLoad = (sequence.loads.reduce((sum, load) => sum + load.share, 0) * loadKg * G) / weight / 2;
  const heights = contacts.map((contact) => new Float64Array(contact.anchors.length));
  const anchorPoints = contacts.map((contact) => contact.anchors.map(() => new Vector3()));

  for (let f = 0; f < frames; f++) {
    const frame = kin.frames[f];
    const angles = kin.angles[f];
    const root = frame.pos[0];
    for (const list of motions)
      for (const motion of list) {
        axes[motion.row].copy(motion.local).applyQuaternion(frame.rot[motion.frame]);
        rate[motion.row] = arm
          .subVectors(spin[f][motion.joint], spin[f][motion.reference])
          .dot(axes[motion.row]);
      }

    known.fill(0);
    net.set(0, 0, 0);
    netMoment.set(0, 0, 0);
    masses.forEach((mass, i) => {
      const load = sequence.loads[i - body.segments.length];
      const at = points[f][i];
      if (load?.pulley) {
        force.set(load.pulley[0], load.pulley[1], load.pulley[2]).sub(at);
        if (force.lengthSq() > 1e-8) force.normalize();
        else force.set(0, -1, 0);
        force.multiplyScalar(mass * G);
      } else if (load?.direction) {
        force.set(load.direction[0], load.direction[1], load.direction[2]);
        if (force.lengthSq() > 1e-8) force.normalize();
        else force.set(0, -1, 0);
        force.multiplyScalar(mass * G);
      } else {
        force.set(-accel[f][i].x, -G - accel[f][i].y, -accel[f][i].z).multiplyScalar(mass);
      }
      for (const j of ancestors[joints[i]]) {
        moment.crossVectors(arm.subVectors(at, frame.pos[j]), force);
        for (const motion of motions[j]) known[motion.row] -= motion.gain * moment.dot(axes[motion.row]);
      }
      net.add(force);
      netMoment.add(moment.crossVectors(arm.subVectors(at, root), force));
      if (!load || load.grip === "rest") return;
      const side = load.anchor.endsWith("_L") ? "L" : load.anchor.endsWith("_R") ? "R" : null;
      if (side)
        known[rowIndex.get(`grip_${side}`)!] += (load.grip === "hang" ? 1 : PRESS_GRIP) * force.length();
    });

    ACTUATORS.forEach((actuator, i) => {
      let speed = 0;
      actuator.entries.forEach((entry, e) => (speed += entry.capacity * rate[columns[i].rows[e]]));
      const factor = speedFactor(speed / peakCapacity[i]);
      actuator.entries.forEach(
        (entry, e) => (columns[i].values[e] = entry.capacity * (entry.scale?.(angles) ?? 1) * factor),
      );
    });

    contacts.forEach((contact, c) => {
      let lowest = Infinity;
      contact.anchors.forEach((name, slot) => {
        const anchor = body.anchors[name];
        worldPoint(frame, anchor.joint, anchor.local, anchorPoints[c][slot]);
        heights[c][slot] = anchorPoints[c][slot].dot(normals[c]);
        lowest = Math.min(lowest, heights[c][slot]);
      });
      for (let slot = 0; slot < contact.anchors.length; slot++) heights[c][slot] -= lowest;
    });
    for (const push of pushes) {
      const { rows, values } = columns[push.column];
      worldPoint(frame, push.point.joint, push.point.local, point);
      let touching = 1;
      if (push.counter) {
        worldPoint(frame, push.counter.joint, push.counter.local, direction).sub(point).normalize();
        if (push.apart) direction.negate();
      } else if (push.limb) {
        // Square to the limb, from its axis out to the hand, and only while the hand is alongside it and close.
        const { joint, length, within } = push.limb;
        far.set(0, -1, 0).applyQuaternion(frame.rot[joint]);
        direction.subVectors(point, frame.pos[joint]);
        const along = direction.dot(far);
        direction.addScaledVector(far, -along);
        const off = direction.length();
        direction.normalize();
        touching =
          clamp((within + LIFTED - off) / (LIFTED - TOUCHING), 0, 1) *
          clamp(1 + Math.min(along, length - along) / LIFTED, 0, 1);
      } else {
        direction.copy(push.direction);
        if (push.local) direction.applyQuaternion(frame.rot[push.point.joint]);
      }
      push.world.copy(direction.multiplyScalar(weight));
      values.fill(0);
      push.turns.forEach((turns, end) => {
        const at =
          end === 0 || !push.counter ? point : worldPoint(frame, push.counter.joint, push.counter.local, far);
        for (const { motion, at: slot } of turns) {
          moment.crossVectors(arm.subVectors(at, frame.pos[motion.joint]), direction);
          values[slot] += (end === 0 ? 1 : -1) * motion.gain * moment.dot(axes[motion.row]);
        }
      });
      let e = push.width;
      if (push.counter) {
        hi[push.column] = FRICTION * barLoad;
        continue;
      }
      if (push.limb) {
        // A hanging weight pressed against a limb is a pendulum held off plumb, which takes a fraction of its weight.
        hi[push.column] = 0.5 * barLoad * touching;
        continue;
      }
      if (free) {
        moment.crossVectors(arm.subVectors(point, root), direction);
        values[e++] = direction.x / weight;
        values[e++] = direction.y / weight;
        values[e++] = direction.z / weight;
        values[e++] = moment.x / (weight * LEVER);
        values[e++] = moment.y / (weight * LEVER);
        values[e++] = moment.z / (weight * LEVER);
      }
      if (push.contact >= 0 && pressRow[push.contact] >= 0)
        values[e++] = direction.dot(normals[push.contact]) / weight;
      if (e < rows.length) values[e++] = -push.grip * direction.length();
      if (push.contact < 0) {
        hi[push.column] = (0.5 * masses[body.segments.length] * G) / weight;
        continue;
      }
      const contact = contacts[push.contact];
      hi[push.column] =
        contact.kind === "hold"
          ? REACH
          : REACH * clamp((LIFTED - heights[push.contact][push.slot]) / (LIFTED - TOUCHING), 0, 1);
    }

    stops.forEach((stop, s) => {
      hi[firstStop + s] = clamp((UNLOCKED - angles[stop.angle]) / (UNLOCKED - LOCKED), 0, 1);
    });

    target.set(known);
    if (free) {
      target[balanceRow] = -net.x / weight;
      target[balanceRow + 1] = -net.y / weight;
      target[balanceRow + 2] = -net.z / weight;
      target[balanceRow + 3] = -netMoment.x / (weight * LEVER);
      target[balanceRow + 4] = -netMoment.y / (weight * LEVER);
      target[balanceRow + 5] = -netMoment.z / (weight * LEVER);
    }
    contacts.forEach((contact, c) => {
      if (pressRow[c] >= 0) target[pressRow[c]] = ((contact.share ?? 0) * loadKg * G) / weight;
    });

    const settle = () => {
      demand.set(known);
      for (const push of pushes) {
        const { rows, values } = columns[push.column];
        for (let e = 0; e < rows.length; e++)
          if (rows[e] < torqueRows) demand[rows[e]] -= values[e] * x[push.column];
      }
      stops.forEach((stop, s) => (demand[stop.row] -= STOP_TORQUE * x[firstStop + s]));
    };
    lo.fill(0, 0, ACTUATORS.length);
    solveBounded(problem, x, state);
    settle();
    for (let row = 0; row < torqueRows; row++) {
      if (!held[row] || secondary[row] || rowNames[row].startsWith("grip")) continue;
      let against = 0;
      for (const { actuator, entry } of opposers[row]) {
        const capacity = columns[actuator].values[entry];
        if (capacity * demand[row] < 0) against += Math.abs(capacity);
      }
      if (against === 0) continue;
      const level = Math.min(0.5, (COCONTRACTION * Math.abs(demand[row])) / against);
      for (const { actuator, entry } of opposers[row])
        if (columns[actuator].values[entry] * demand[row] < 0) lo[actuator] = Math.max(lo[actuator], level);
    }
    solveBounded(problem, x, state);
    settle();

    const short: { dof: string; fraction: number }[] = [];
    for (let row = 0; row < torqueRows; row++) {
      if (!held[row] || secondary[row]) continue;
      let supplied = 0;
      for (const { actuator, entry } of opposers[row]) supplied += x[actuator] * columns[actuator].values[entry];
      const fraction = Math.abs(supplied - demand[row]) / rowScale[row];
      if (fraction > 0.06) short.push({ dof: rowNames[row], fraction });
    }
    unmet.push(short);
    demandsOut.push(Object.fromEntries(rowNames.map((name, row) => [name, demand[row]])));

    const pushed = new Map<string, Vector3>();
    let rail = 0;
    for (const push of pushes) {
      if (x[push.column] === 0) continue;
      if (push.contact < 0 && !push.counter && !push.limb) rail += push.world.z * x[push.column];
      else
        pushed.set(
          push.anchor,
          (pushed.get(push.anchor) ?? new Vector3()).addScaledVector(push.world, x[push.column]),
        );
      if (push.counter || push.limb)
        pushed.set(
          `${push.anchor} across`,
          (pushed.get(`${push.anchor} across`) ?? new Vector3()).addScaledVector(push.world, -x[push.column]),
        );
    }
    reactions.push([...pushed].map(([anchor, total]) => ({ anchor, force: [total.x, total.y, total.z] })));
    support.push(
      sequence.support.kind === "standing"
        ? balance(net, netMoment, root, contacts, anchorPoints, heights, rail)
        : null,
    );

    const act = new Float32Array(MUSCLES.length * 2);
    ACTUATORS.forEach((actuator, i) => {
      const slot = MUSCLES.indexOf(actuator.muscle) * 2 + (actuator.side === "L" ? 0 : 1);
      act[slot] = Math.max(act[slot], x[i]);
    });
    const str = new Float32Array(MUSCLES.length * 2);
    MUSCLES.forEach((muscle, m) => {
      SIDES.forEach((side, s) => (str[m * 2 + s] = stretchOf(muscle, angles, side)));
    });
    activation.push(act);
    stretch.push(str);
  }

  smoothActivation(activation, sequence.fps);
  activation.forEach((act, f) =>
    tendon.push(Float32Array.from(act, (level, k) => level + passiveForce(stretch[f][k]))),
  );

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
  return { loadKg, activation, stretch, tendon, peak, support, unmet, demands: demandsOut, reactions };
}

/** First-order activation dynamics over the looping rep, so effort ramps the way a muscle can, not frame to frame. */
function smoothActivation(rows: Float32Array[], fps: number) {
  const dt = 1 / fps;
  const state = Float32Array.from(rows[rows.length - 1]);
  // Two laps settle the loop, so the first frame follows on from the last.
  for (let lap = 0; lap < 2; lap++) {
    for (const row of rows) {
      for (let k = 0; k < row.length; k++) {
        const tau = row[k] > state[k] ? ACTIVATION_TIME.rise : ACTIVATION_TIME.fall;
        state[k] += (row[k] - state[k]) * (1 - Math.exp(-dt / tau));
        if (lap === 1) row[k] = state[k];
      }
    }
  }
}

/**
 * Where the floor would have to push for a standing lifter to balance, against the outline of the feet that are
 * down. The contact forces above stay inside the feet whatever the pose, so this is what says a pose would tip.
 */
function balance(
  net: Vector3,
  netMoment: Vector3,
  root: Vector3,
  contacts: Contact[],
  anchorPoints: Vector3[][],
  heights: Float64Array[],
  rail: number,
): FrameSupport {
  const up = Math.max(1, -net.y);
  const about = new Vector3().crossVectors(root, net).add(netMoment);
  const cop: [number, number] = [-about.z / up, about.x / up];
  let back = Infinity;
  let front = -Infinity;
  let left = -Infinity;
  let right = Infinity;
  contacts.forEach((contact, c) => {
    if (contact.kind !== "rest") return;
    anchorPoints[c].forEach((at, slot) => {
      if (heights[c][slot] > (TOUCHING + LIFTED) / 2) return;
      back = Math.min(back, at.z);
      front = Math.max(front, at.z);
      left = Math.max(left, at.x);
      right = Math.min(right, at.x);
    });
  });
  const margin = Math.min(cop[1] - (back - 0.02), front - cop[1], left + 0.02 - cop[0], cop[0] - (right - 0.02));
  return { cop, margin, rail };
}
