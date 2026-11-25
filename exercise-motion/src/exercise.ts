import { Vector3 } from "three";
import {
  anchorPoint,
  angles,
  createBody,
  fk,
  interpolatePose,
  makePose,
  newFrame,
  selfCollisionPairs,
  type Angles,
  type Body,
  type Frame,
  type PoseHints,
  type Side,
} from "./body";
import type { GlbRef, Part, PropDef, PropState, TetherDef, TetherState } from "./equipment";
import { lerp, minJerk, type Vec3 } from "./math";
import { solve, type Goal, type Obstacle } from "./solver";

export type Laterality = "bilateral" | "unilateral" | "alternating" | "asymmetrical";
export type GripStyle = "hang" | "press" | "open";

/**
 * Where external weight bears on the body.
 * - `hang`: pulls on a closed hand (dumbbells, barbells hanging, cables)
 * - `press`: pushes into the palm (bench press, overhead press, machine press)
 * - `rest`: sits on the trunk, shoulders, hips, or legs (squat bar, hip thrust bar, leg extension roller)
 * If `pulley` is given, force pulls along the unit vector from the body anchor toward `pulley` each frame.
 * Else if `direction` is given, force acts along that unit world direction (e.g. `[0, 1, 0]` for assistance).
 * Otherwise gravity acts downward `[0, -1, 0]`.
 */
export interface LoadAttachment {
  anchor: string;
  /** Fraction of the logged weight this point carries (use 0 for purely bodyweight loads; negative reduces bodyweightShare on assisted machines). */
  share: number;
  /** Optional fraction of the lifter's body mass carried at this contact (e.g. 0.5 per hand on pull-ups/dips, 0.32 per hand on push-ups). */
  bodyweightShare?: number;
  grip: "hang" | "press" | "rest";
  /** World-space cable pulley or band anchor point that pulls on this body anchor. */
  pulley?: Vec3;
  /** Fixed world-space force direction (normalized internally). Overrides gravity when set. */
  direction?: Vec3;
}

export interface Support {
  kind: "standing" | "lying" | "seated" | "hanging" | "supported";
  /** The bar or sled rides rails, which take the horizontal force a free load would need balance for. */
  rail?: boolean;
  /** Which feet carry standing balance (`["L", "R"]` default; `["L"]` for single-leg standing). */
  feet?: Side[];
  /** Joints carried by a bench, seat, pad, or floor, so their muscles hold no load. */
  passive?: string[];
  /** The instructions have the lifter brace the core, so the abdominals work through the whole rep. */
  brace?: boolean;
}

export interface RequiredContact {
  label: string;
  anchor: string;
  /** Height of a horizontal surface the anchor rests on (e.g. 0 for floor). */
  surfaceY?: number;
  /** Id of a moving prop the anchor holds or pushes. */
  prop?: string;
  /** Id of a static equipment part the anchor rests on (e.g. `"bench.backPad"`). */
  part?: string;
  /** True when the anchor intentionally slides or rolls across a surface during the rep (skips slide warning). */
  allowSlide?: boolean;
}

export interface CheckContext {
  body: Body;
  sequence: Sequence;
  frames: Frame[];
  angles: Angles[];
  /** Frame indexes of the start position and of the peak/end-of-phase-1 position. */
  top: number;
  bottom: number;
}

export interface CheckResult {
  id: string;
  label: string;
  /** The instruction the check comes from, quoted from the app's catalog. */
  cue: string;
  pass: boolean;
  measured: string;
}

export interface FormCheck {
  id: string;
  label: string;
  cue: string;
  evaluate: (context: CheckContext) => { pass: boolean; measured: string };
}

export interface Tempo {
  lower: number;
  bottom: number;
  raise: number;
  top: number;
}

export interface WaypointSpec {
  hints: PoseHints;
  goals?: Goal[];
  extras?: number[];
  /** Seconds to travel from the previous waypoint to this one (ignored for waypoint 0 unless cycling). */
  duration?: number;
  /** Seconds to pause at this waypoint. */
  hold?: number;
}

export interface CameraHint {
  view?: "Front" | "Back" | "Side" | "Angle" | "Top";
  target?: Vec3;
}

export interface Built {
  hints: { start: PoseHints; end: PoseHints };
  /** Optional multi-waypoint path for alternating, cyclic, or multi-stage exercises (e.g. clean & press, walking lunge, alternating curl). */
  waypoints?: WaypointSpec[];
  /** For `waypoints`: `"cycle"` loops back from the last waypoint to waypoint 0; `"pingpong"` reverses. Default `"cycle"`. */
  loopMode?: "cycle" | "pingpong";
  /** True for isometric holds (plank, dead hang, wall sit) where start and end pose coincide. */
  isometric?: boolean;
  /** Custom timeline phase names (defaults to Lower / Bottom / Lift / Top). */
  phaseLabels?: [string, string, string, string];
  /** Unknowns besides the body's joints, such as a bar's height, appended after the body's degrees of freedom. */
  extras: number;
  extraStart: number[];
  goals: Goal[];
  keyGoals: { start: Goal[]; end: Goal[] };
  /** Pull toward the reference pose per `joint` or `joint.motion`, in residual units per radian. */
  stiffness: Record<string, number>;
  obstacles: Obstacle[];
  /** The extras at rep phase `s`, between their solved values at the start and the end. */
  path?: (s: number, start: number[], end: number[]) => number[];
  /**
   * How far through the rep a pose is, as any quantity that moves one way from the start pose to the end pose:
   * the bar's height, the hands' height, a joint angle.
   */
  progress: (frame: Frame) => number;
  /** An anchor that stays put through the rep, such as a planted heel or sacrum. Blended reference poses are moved to keep it there. */
  ground: string;
  props: PropDef[];
  propState: (frame: Frame, extras: number[]) => PropState[];
  tethers?: TetherDef[];
  tetherState?: (frame: Frame, extras: number[], propStates: PropState[]) => TetherState[];
  equipment: (keys: {
    start: Float64Array;
    end: Float64Array;
    startFrame: Frame;
    endFrame: Frame;
  }) => Part[];
  glb?: GlbRef[];
  loads: LoadAttachment[];
  support: Support;
  tempo: Tempo;
  /** Equipment or prop id prefix to the body capsules allowed to touch it, with the depth each may press in. */
  contacts: Record<string, Record<string, number>>;
  required: RequiredContact[];
  checks: FormCheck[];
  laterality?: Laterality;
  grip?: GripStyle;
  cameraHint?: CameraHint;
}

export interface ExerciseSpec {
  id: string;
  catalogId: string;
  name: string;
  defaultLoadKg: number;
  loadUnit: "total" | "perSide";
  laterality?: Laterality;
  build: (body: Body) => Built;
}

export interface Phase {
  name: keyof Tempo;
  label?: string;
  from: number;
  to: number;
}

/** A baked rep: everything a player needs to replay it and the analysis needs to load it, with no solver. */
export interface Sequence {
  id: string;
  catalogId: string;
  name: string;
  fps: number;
  lifter: { height: number; mass: number };
  loadKg: number;
  loadUnit: "total" | "perSide";
  laterality?: Laterality;
  grip?: GripStyle;
  cameraHint?: CameraHint;
  /** One pose per frame: the body's degrees of freedom, as `createBody` lays them out. */
  poses: number[][];
  /** Rep phase per frame, 0 at the start position and 1 at the end of the first movement phase. */
  s: number[];
  phases: Phase[];
  props: PropDef[];
  propStates: PropState[][];
  tethers?: TetherDef[];
  tetherStates?: TetherState[][];
  equipment: Part[];
  glb?: GlbRef[];
  loads: LoadAttachment[];
  support: Support;
  contacts: Record<string, Record<string, number>>;
  required: RequiredContact[];
}

export interface Generated {
  body: Body;
  built: Built;
  sequence: Sequence;
  keys: { start: Float64Array; end: Float64Array };
}

const SAMPLES = 32;
export const FPS = 30;

function priorWeights(
  body: Body,
  stiffness: Record<string, number>,
  extras: number,
  extraWeight: number,
) {
  const weights = new Float64Array(body.dofCount + extras).fill(0);
  for (const joint of body.joints) {
    const base = joint.side ? joint.name.slice(0, -2) : joint.name;
    const whole = stiffness[joint.name] ?? stiffness[base] ?? stiffness.default ?? 0.5;
    if (joint.kind === "root") {
      for (let i = 3; i < 6; i++) weights[i] = stiffness.root ?? 0.3;
      continue;
    }
    const count = joint.kind === "ball" ? 3 : joint.dofs.length;
    for (let n = 0; n < count; n++) {
      const motion = joint.dofs[n]?.name;
      weights[joint.dofStart + n] =
        (motion
          ? (stiffness[`${joint.name}.${motion}`] ?? stiffness[`${base}.${motion}`])
          : undefined) ?? whole;
    }
  }
  for (let i = 0; i < extras; i++) weights[body.dofCount + i] = extraWeight;
  return weights;
}

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 *
  (2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

function assertSpecInputs(spec: ExerciseSpec, built: Built, body: Body) {
  if (!spec.id || !/^[a-z0-9-]+$/.test(spec.id)) {
    throw new Error(`Invalid exercise id "${spec.id}": expected lowercase kebab-case.`);
  }
  if (!spec.catalogId) {
    throw new Error(`${spec.id}: missing catalogId.`);
  }
  if (!Number.isFinite(spec.defaultLoadKg) || spec.defaultLoadKg < 0) {
    throw new Error(`${spec.id}: defaultLoadKg must be finite and >= 0, got ${spec.defaultLoadKg}.`);
  }
  if (!body.anchors[built.ground]) {
    throw new Error(`${spec.id}: unknown ground anchor "${built.ground}".`);
  }
  if (built.extraStart.length !== built.extras) {
    throw new Error(
      `${spec.id}: extraStart length (${built.extraStart.length}) must equal extras (${built.extras}).`,
    );
  }
  for (const load of built.loads) {
    if (!body.anchors[load.anchor]) {
      throw new Error(`${spec.id}: unknown load anchor "${load.anchor}".`);
    }
    if (!Number.isFinite(load.share) || (load.share < 0 && !(load.bodyweightShare && load.bodyweightShare > 0))) {
      throw new Error(`${spec.id}: invalid load share ${load.share} on ${load.anchor}.`);
    }
    if (load.bodyweightShare !== undefined && (!Number.isFinite(load.bodyweightShare) || load.bodyweightShare < 0)) {
      throw new Error(`${spec.id}: invalid bodyweightShare ${load.bodyweightShare} on ${load.anchor}.`);
    }
  }
  const propIds = new Set(built.props.map((p) => p.id));
  for (const contact of built.required) {
    if (!body.anchors[contact.anchor]) {
      throw new Error(`${spec.id}: unknown required contact anchor "${contact.anchor}".`);
    }
    const modeCount =
      (contact.surfaceY !== undefined ? 1 : 0) +
      (contact.prop !== undefined ? 1 : 0) +
      (contact.part !== undefined ? 1 : 0);
    if (modeCount !== 1) {
      throw new Error(
        `${spec.id}: required contact "${contact.label}" must set exactly one of surfaceY, prop, or part.`,
      );
    }
    if (contact.prop !== undefined && !propIds.has(contact.prop)) {
      throw new Error(
        `${spec.id}: required contact "${contact.label}" references unknown prop "${contact.prop}".`,
      );
    }
  }
  for (const [prefix, allowed] of Object.entries(built.contacts)) {
    for (const colliderId of Object.keys(allowed)) {
      if (body.colliderIndex[colliderId] === undefined) {
        throw new Error(
          `${spec.id}: contacts["${prefix}"] references unknown collider "${colliderId}".`,
        );
      }
    }
  }
  for (const [sideName, hintMap] of Object.entries(built.hints)) {
    for (const [key, val] of Object.entries(hintMap)) {
      if (!Number.isFinite(val)) {
        throw new Error(`${spec.id}: hints.${sideName}["${key}"] is not finite (${val}).`);
      }
    }
  }
}

function assertFiniteArray(label: string, values: ArrayLike<number>) {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new Error(`${label}[${i}] is not finite (${values[i]}).`);
    }
  }
}

/** Solves the key poses, then the rep between them, and times it into frames. */
export function generate(spec: ExerciseSpec, body = createBody()): Generated {
  const built = spec.build(body);
  assertSpecInputs(spec, built, body);

  const n = body.dofCount;
  const selfPairs = selfCollisionPairs(body);
  const withExtras = (pose: Float64Array, extras: number[]) => {
    const q = new Float64Array(n + built.extras);
    q.set(pose);
    extras.forEach((value, i) => (q[n + i] = value));
    return q;
  };

  const free = priorWeights(body, built.stiffness, built.extras, 0);
  const solveKey = (hints: PoseHints, goals: Goal[], extraSeed = built.extraStart, label = "key") => {
    const prior = withExtras(makePose(body, hints), extraSeed);
    const res = solve(body, prior, {
      goals: [...built.goals, ...goals],
      prior,
      priorWeights: free,
      selfPairs,
      obstacles: built.obstacles,
      iterations: 150,
    });
    assertFiniteArray(`${spec.id} ${label} pose`, res.q);
    return res.q;
  };

  let start: Float64Array;
  let end: Float64Array;
  let poses: Float64Array[];
  let s: number[];
  let phases: Phase[];

  if (built.waypoints && built.waypoints.length >= 2) {
    const solved = built.waypoints.map((wp, idx) =>
      solveKey(wp.hints, wp.goals ?? [], wp.extras ?? built.extraStart, `waypoint[${idx}]`),
    );
    start = solved[0];
    end = solved[Math.min(1, solved.length - 1)];
    const driven = priorWeights(body, built.stiffness, built.extras, 200);
    const scratch = newFrame(body);
    const grounded = anchorPoint(body, fk(body, start, scratch), built.ground);
    const drift = new Vector3();

    const loopMode = built.loopMode ?? "cycle";
    const segPairs: { from: Float64Array; to: Float64Array; duration: number; hold: number; sFrom: number; sTo: number }[] = [];
    const totalSegs = loopMode === "cycle" ? solved.length : solved.length - 1;
    for (let k = 0; k < totalSegs; k++) {
      const next = (k + 1) % solved.length;
      const wp = built.waypoints[next];
      segPairs.push({
        from: solved[k],
        to: solved[next],
        duration: wp.duration ?? 1.2,
        hold: wp.hold ?? 0.15,
        sFrom: k / totalSegs,
        sTo: (k + 1) / totalSegs,
      });
    }
    if (loopMode === "pingpong") {
      for (let k = solved.length - 1; k > 0; k--) {
        const wp = built.waypoints[k - 1];
        segPairs.push({
          from: solved[k],
          to: solved[k - 1],
          duration: wp.duration ?? 1.2,
          hold: wp.hold ?? 0.15,
          sFrom: k / (solved.length - 1),
          sTo: (k - 1) / (solved.length - 1),
        });
      }
    }

    poses = [];
    s = [];
    phases = [];
    const subSamples = 12;
    const phaseNames: (keyof Tempo)[] = ["lower", "bottom", "raise", "top"];
    for (let segIdx = 0; segIdx < segPairs.length; segIdx++) {
      const seg = segPairs[segIdx];
      const knots: Float64Array[] = [];
      for (let i = 0; i <= subSamples; i++) {
        const u = i / subSamples;
        const prior = interpolatePose(body, seg.from, seg.to, u, new Float64Array(n + built.extras));
        drift.subVectors(grounded, anchorPoint(body, fk(body, prior, scratch), built.ground));
        prior[0] += drift.x;
        prior[1] += drift.y;
        prior[2] += drift.z;
        knots.push(
          solve(body, prior, {
            goals: built.goals,
            prior,
            priorWeights: driven,
            selfPairs,
            obstacles: built.obstacles,
          }).q,
        );
      }
      const moveFrames = Math.max(2, Math.round(seg.duration * FPS));
      const startIdx = poses.length;
      for (let f = 0; f < moveFrames; f++) {
        const u = minJerk(f / moveFrames);
        const x = u * subSamples;
        const i = Math.min(Math.floor(x), subSamples - 1);
        const t = x - i;
        const p0 = knots[Math.max(i - 1, 0)];
        const p1 = knots[i];
        const p2 = knots[i + 1];
        const p3 = knots[Math.min(i + 2, subSamples)];
        poses.push(Float64Array.from(p1, (_, d) => catmullRom(p0[d], p1[d], p2[d], p3[d], t)));
        s.push(lerp(seg.sFrom, seg.sTo, u));
      }
      phases.push({
        name: phaseNames[segIdx % 4],
        label: built.phaseLabels?.[segIdx % 4],
        from: startIdx,
        to: poses.length - 1,
      });
      const holdFrames = Math.round(seg.hold * FPS);
      if (holdFrames > 0) {
        const holdStart = poses.length;
        const held = knots[subSamples];
        for (let f = 0; f < holdFrames; f++) {
          poses.push(Float64Array.from(held));
          s.push(seg.sTo);
        }
        phases.push({
          name: segIdx === 0 ? "bottom" : "top",
          from: holdStart,
          to: poses.length - 1,
        });
      }
    }
  } else {
    start = solveKey(built.hints.start, built.keyGoals.start, built.extraStart, "start");
    end = built.isometric
      ? Float64Array.from(start)
      : solveKey(built.hints.end, built.keyGoals.end, built.extraStart, "end");
    const startExtras = [...start.subarray(n)];
    const endExtras = [...end.subarray(n)];
    const path = built.path ?? ((u, a, b) => a.map((value, i) => lerp(value, b[i], u)));

    const driven = priorWeights(body, built.stiffness, built.extras, 200);
    const scratch = newFrame(body);
    const grounded = anchorPoint(body, fk(body, start, scratch), built.ground);
    const drift = new Vector3();
    // Blending two poses' joint angles and root position doesn't keep the planted contact fixed,
    // so the blend is translated back onto its planted anchor before solving.
    const blendAt = (u: number, out: Float64Array) => {
      interpolatePose(body, start, end, u, out);
      drift.subVectors(grounded, anchorPoint(body, fk(body, out, scratch), built.ground));
      out[0] += drift.x;
      out[1] += drift.y;
      out[2] += drift.z;
      return out;
    };
    const blend = new Float64Array(n + built.extras);
    const progressAt = (u: number) => built.progress(fk(body, blendAt(u, blend), scratch));
    const from = progressAt(0);
    const to = progressAt(1);
    const hasProgressSpan = !built.isometric && Math.abs(to - from) > 1e-4;

    const samples: Float64Array[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const uTarget = i / SAMPLES;
      let u = uTarget;
      if (hasProgressSpan) {
        let lo = 0;
        let hi = 1;
        const target = from + (to - from) * uTarget;
        for (let step = 0; step < 24; step++) {
          const mid = (lo + hi) / 2;
          if ((progressAt(mid) - target) * (to - from) < 0) lo = mid;
          else hi = mid;
        }
        u = (lo + hi) / 2;
      }
      const prior = blendAt(u, new Float64Array(n + built.extras));
      path(uTarget, startExtras, endExtras).forEach((value, e) => (prior[n + e] = value));
      const solved = solve(body, prior, {
        goals: built.goals,
        prior,
        priorWeights: driven,
        selfPairs,
        obstacles: built.obstacles,
      }).q;
      assertFiniteArray(`${spec.id} sample[${i}]`, solved);
      samples.push(solved);
    }

    const poseAt = (u: number) => {
      const x = Math.min(Math.max(u, 0), 1) * SAMPLES;
      const i = Math.min(Math.floor(x), SAMPLES - 1);
      const t = x - i;
      const p0 = samples[Math.max(i - 1, 0)];
      const p1 = samples[i];
      const p2 = samples[i + 1];
      const p3 = samples[Math.min(i + 2, SAMPLES)];
      return Float64Array.from(p1, (_, d) => catmullRom(p0[d], p1[d], p2[d], p3[d], t));
    };

    const { tempo } = built;
    const order: (keyof Tempo)[] = ["lower", "bottom", "raise", "top"];
    phases = [];
    s = [];
    order.forEach((name, idx) => {
      const count = Math.max(1, Math.round(tempo[name] * FPS));
      phases.push({
        name,
        label: built.phaseLabels?.[idx],
        from: s.length,
        to: s.length + count - 1,
      });
      for (let f = 0; f < count; f++) {
        const u = f / count;
        s.push(
          name === "lower"
            ? minJerk(u)
            : name === "raise"
              ? 1 - minJerk(u)
              : name === "bottom"
                ? 1
                : 0,
        );
      }
    });
    poses = s.map((value) => poseAt(value));
  }

  const frame = newFrame(body);
  const propStates = poses.map((pose, f) => {
    const states = built.propState(fk(body, pose, frame), [...pose.subarray(n)]);
    if (states.length !== built.props.length) {
      throw new Error(
        `${spec.id}: propState returned ${states.length} items at frame ${f}, expected ${built.props.length}.`,
      );
    }
    for (const st of states) {
      assertFiniteArray(`${spec.id} propState[${f}].pos`, st.pos);
      assertFiniteArray(`${spec.id} propState[${f}].quat`, st.quat);
    }
    return states;
  });

  const tethers = built.tethers;
  const tetherStates =
    tethers && built.tetherState
      ? poses.map((pose, f) => {
          const ts = built.tetherState!(fk(body, pose, frame), [...pose.subarray(n)], propStates[f]);
          if (ts.length !== tethers.length) {
            throw new Error(
              `${spec.id}: tetherState returned ${ts.length} items at frame ${f}, expected ${tethers.length}.`,
            );
          }
          for (const t of ts) {
            if (t.points.length < 2) {
              throw new Error(`${spec.id}: tether at frame ${f} must have at least 2 points.`);
            }
            for (const pt of t.points) assertFiniteArray(`${spec.id} tether[${f}]`, pt);
          }
          return ts;
        })
      : undefined;

  const equipment = built.equipment({
    start,
    end,
    startFrame: fk(body, start, newFrame(body)),
    endFrame: fk(body, end, newFrame(body)),
  });
  const partIds = new Set(equipment.map((part) => part.id));
  for (const contact of built.required) {
    if (contact.part && !partIds.has(contact.part)) {
      throw new Error(
        `${spec.id}: required contact "${contact.label}" references missing equipment part "${contact.part}". Available: ${[...partIds].join(", ")}`,
      );
    }
  }

  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  const sequence: Sequence = {
    id: spec.id,
    catalogId: spec.catalogId,
    name: spec.name,
    fps: FPS,
    lifter: { height: body.height, mass: body.mass },
    loadKg: spec.defaultLoadKg,
    loadUnit: spec.loadUnit,
    laterality: built.laterality ?? spec.laterality ?? "bilateral",
    grip: built.grip,
    cameraHint: built.cameraHint,
    poses: poses.map((pose) => [...pose.subarray(0, n)].map(round)),
    s: s.map(round),
    phases,
    props: built.props,
    propStates: propStates.map((states) =>
      states.map((state) => ({
        pos: state.pos.map(round) as PropState["pos"],
        quat: state.quat.map(round) as PropState["quat"],
      })),
    ),
    ...(tethers ? { tethers } : {}),
    ...(tetherStates
      ? {
          tetherStates: tetherStates.map((row) =>
            row.map((st) => ({
              points: st.points.map((pt) => pt.map(round) as Vec3),
            })),
          ),
        }
      : {}),
    equipment,
    ...(built.glb?.length ? { glb: built.glb } : {}),
    loads: built.loads,
    support: built.support,
    contacts: built.contacts,
    required: built.required,
  };
  return { body, built, sequence, keys: { start, end } };
}

export interface Kinematics {
  frames: Frame[];
  angles: Angles[];
}

export function kinematics(body: Body, sequence: Sequence): Kinematics {
  return {
    frames: sequence.poses.map((pose) => fk(body, pose, newFrame(body))),
    angles: sequence.poses.map((pose) => angles(body, pose)),
  };
}
