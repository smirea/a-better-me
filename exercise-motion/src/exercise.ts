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
} from "./body";
import type { Part, PropDef, PropState } from "./equipment";
import { lerp, minJerk } from "./math";
import { solve, type Goal, type Obstacle } from "./solver";

/** Where the weight bears on the body. `hang` pulls on a closed hand, `press` pushes into the palm, `rest` sits on the trunk. */
export interface LoadAttachment {
  anchor: string;
  /** Fraction of the logged weight this point carries. */
  share: number;
  grip: "hang" | "press" | "rest";
}

export interface Support {
  kind: "standing" | "lying";
  /** The bar rides rails, which take the horizontal force a free bar would need balance for. */
  rail?: boolean;
  /** Joints the bench or floor carries, so their muscles hold no load. */
  passive?: string[];
  /** The instructions have the lifter brace the core, so the abdominals work through the whole rep. */
  brace?: boolean;
}

export interface RequiredContact {
  label: string;
  anchor: string;
  /** Height of the surface the anchor rests on, or the id of the prop it holds. */
  surfaceY?: number;
  prop?: string;
}

export interface CheckContext {
  body: Body;
  sequence: Sequence;
  frames: Frame[];
  angles: Angles[];
  /** Frame indexes of the start position and of the end of the lowering phase. */
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

export interface Built {
  hints: { start: PoseHints; end: PoseHints };
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
   * the bar's height, the hands' height.
   */
  progress: (frame: Frame) => number;
  /** An anchor that stays put through the rep, such as a planted heel. Blended reference poses are moved to keep it there. */
  ground: string;
  props: PropDef[];
  propState: (frame: Frame, extras: number[]) => PropState[];
  equipment: (keys: {
    start: Float64Array;
    end: Float64Array;
    startFrame: Frame;
    endFrame: Frame;
  }) => Part[];
  loads: LoadAttachment[];
  support: Support;
  tempo: Tempo;
  /** Equipment or prop id prefix to the body capsules allowed to touch it, with the depth each may press in. */
  contacts: Record<string, Record<string, number>>;
  required: RequiredContact[];
  checks: FormCheck[];
}

export interface ExerciseSpec {
  id: string;
  catalogId: string;
  name: string;
  defaultLoadKg: number;
  loadUnit: "total" | "perSide";
  build: (body: Body) => Built;
}

export interface Phase {
  name: keyof Tempo;
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
  /** One pose per frame: the body's degrees of freedom, as `createBody` lays them out. */
  poses: number[][];
  /** Rep phase per frame, 0 at the start position and 1 at the end of the lowering. */
  s: number[];
  phases: Phase[];
  props: PropDef[];
  propStates: PropState[][];
  equipment: Part[];
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

/** Solves the two key poses, then the rep between them, and times it into frames. */
export function generate(spec: ExerciseSpec, body = createBody()): Generated {
  const built = spec.build(body);
  const n = body.dofCount;
  const selfPairs = selfCollisionPairs(body);
  const withExtras = (pose: Float64Array, extras: number[]) => {
    const q = new Float64Array(n + built.extras);
    q.set(pose);
    extras.forEach((value, i) => (q[n + i] = value));
    return q;
  };

  const free = priorWeights(body, built.stiffness, built.extras, 0);
  const solveKey = (hints: PoseHints, goals: Goal[]) => {
    const prior = withExtras(makePose(body, hints), built.extraStart);
    return solve(body, prior, {
      goals: [...built.goals, ...goals],
      prior,
      priorWeights: free,
      selfPairs,
      obstacles: built.obstacles,
      iterations: 150,
    }).q;
  };
  const start = solveKey(built.hints.start, built.keyGoals.start);
  const end = solveKey(built.hints.end, built.keyGoals.end);
  const startExtras = [...start.subarray(n)];
  const endExtras = [...end.subarray(n)];
  const path = built.path ?? ((s, a, b) => a.map((value, i) => lerp(value, b[i], s)));

  const driven = priorWeights(body, built.stiffness, built.extras, 200);
  const scratch = newFrame(body);
  const grounded = anchorPoint(body, fk(body, start, scratch), built.ground);
  const drift = new Vector3();
  // Blending two poses' joint angles and root position doesn't keep the feet where they were, so the blend is
  // moved back onto its planted anchor before anything reads it.
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
  const samples: Float64Array[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const s = i / SAMPLES;
    // Joint angles and the weight's travel aren't proportional: a squat's first 30 degrees of knee bend lower the
    // bar far less than its last 30. So the reference pose for a point on the weight's path is the blend of the
    // key poses that puts the weight there, found by bisection, not the blend at the same fraction.
    let lo = 0;
    let hi = 1;
    const target = from + (to - from) * s;
    for (let step = 0; step < 24; step++) {
      const mid = (lo + hi) / 2;
      if ((progressAt(mid) - target) * (to - from) < 0) lo = mid;
      else hi = mid;
    }
    const prior = blendAt((lo + hi) / 2, new Float64Array(n + built.extras));
    path(s, startExtras, endExtras).forEach((value, e) => (prior[n + e] = value));
    // Each sample starts from its reference pose, not its neighbour's answer. A rep can meet its constraints in
    // more than one way (a squat can also drop by pushing the hips forward), and following the neighbour tracks
    // whichever branch the first sample fell into until that branch runs out and the pose jumps.
    samples.push(
      solve(body, prior, {
        goals: built.goals,
        prior,
        priorWeights: driven,
        selfPairs,
        obstacles: built.obstacles,
      }).q,
    );
  }

  const poseAt = (s: number) => {
    const x = Math.min(Math.max(s, 0), 1) * SAMPLES;
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
  const phases: Phase[] = [];
  const s: number[] = [];
  for (const name of order) {
    const count = Math.max(1, Math.round(tempo[name] * FPS));
    phases.push({ name, from: s.length, to: s.length + count - 1 });
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
  }

  const frame = newFrame(body);
  const poses = s.map((value) => poseAt(value));
  const propStates = poses.map((pose) =>
    built.propState(fk(body, pose, frame), [...pose.subarray(n)]),
  );
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  const sequence: Sequence = {
    id: spec.id,
    catalogId: spec.catalogId,
    name: spec.name,
    fps: FPS,
    lifter: { height: body.height, mass: body.mass },
    loadKg: spec.defaultLoadKg,
    loadUnit: spec.loadUnit,
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
    equipment: built.equipment({
      start,
      end,
      startFrame: fk(body, start, newFrame(body)),
      endFrame: fk(body, end, newFrame(body)),
    }),
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
