import { cablesTaut, handsAlongLoads, leastEffort } from "./effort";
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
import type { HandGripConfig, PerHandGrip } from "./contracts";
import {
  compileParts,
  propParts,
  type GlbNodePose,
  type GlbRef,
  type Part,
  type PropDef,
  type PropState,
  type TetherDef,
  type TetherState,
} from "./equipment";
import { resolveGrips, type Grasp } from "./grasp";
import { lerp, minJerk, type Vec3 } from "./math";
import { solve, type Goal, type Obstacle } from "./solver";

export type Laterality = "bilateral" | "unilateral" | "alternating" | "asymmetrical";

/**
 * Where external weight bears on the body.
 * - `hang`: pulls on a closed hand (dumbbells, barbells hanging, cables)
 * - `press`: pushes into the palm (bench press, overhead press, machine press)
 * - `rest`: sits on the trunk, shoulders, hips, or legs (squat bar, hip thrust bar, leg extension roller)
 * If `pulley` is given, force pulls along the unit vector from the body anchor toward `pulley` each frame.
 * Else if `direction` is given, force acts along that unit world direction (e.g. `[0, 1, 0]` for assistance).
 * Otherwise gravity acts downward `[0, -1, 0]`.
 */
/** A known force on the body: a weight it carries, a cable that pulls it, or a pad that pushes it a fixed way. */
export interface LoadAttachment {
  anchor: string;
  /** Fraction of the logged weight this point carries. */
  share: number;
  grip: "hang" | "press" | "rest";
  /**
   * A second hand on the same rigid thing: a barbell, a cable bar. The load then acts on the bar, midway between
   * the two anchors, and the hands share it however keeps the bar balanced. That lets them push or pull along the
   * bar as far as their grip holds, which is how a wide grip hangs from straight arms and a bench press spreads
   * the bar.
   */
  with?: string;
  /** How far toward the pulley the cable's eye sits from the line between the two hands, in metres. */
  eye?: number;
  /**
   * The cable's length from the pulley to its eye with the weight stack on its pin. Shorter than this the cable is
   * slack and pulls nothing, whatever weight is selected.
   */
  rest?: number;
  /** World-space cable pulley or band anchor point that pulls on this body anchor. */
  pulley?: Vec3;
  /** Fixed world-space force direction (normalized internally). Overrides gravity when set. */
  direction?: Vec3;
}

/**
 * Something the body pushes against, which pushes back with whatever balance needs: never a number a spec asserts.
 * Where balance leaves a choice, the lifter takes the push that costs the muscles least.
 */
export interface Contact {
  /** `rest` presses on a surface and grips it by friction. `hold` is a fixed handle, which can pull as well. */
  kind: "rest" | "hold";
  /** Body anchors on the surface, which share its push. One that lifts off the others stops carrying. */
  anchors: string[];
  /** The way the surface pushes the body, straight up by default. */
  normal?: Vec3;
  /**
   * Fraction of the logged weight the surface presses with along its normal, for a plate that rides rails (a leg
   * press sled). A fixed surface leaves it unset.
   */
  share?: number;
}

const SOLE_ANCHORS = ["heel", "ballIn", "ballOut", "forefoot", "toe"];
const PALM_ANCHORS = ["palmHeel", "knuckles", "fingertips"];

/** A foot on a surface: the heel, both sides of the ball, the forefoot under the toe joint, and the toes. */
export const footContact = (side: Side, on: Pick<Contact, "normal" | "share"> = {}): Contact => ({
  kind: "rest",
  anchors: SOLE_ANCHORS.map((point) => `${point}_${side}`),
  ...on,
});

/** A flat hand on a surface: the heel of the hand, the knuckle pads and the fingertips. */
export const palmContact = (side: Side, on: Pick<Contact, "normal" | "share"> = {}): Contact => ({
  kind: "rest",
  anchors: PALM_ANCHORS.map((point) => `${point}_${side}`),
  ...on,
});

export interface Support {
  /**
   * What carries the pelvis. `seated`, `lying` and `supported` rest it on a seat, bench or pad, which takes
   * whatever the loads and contacts leave over. `standing`, `hanging` and `planted` leave the whole body to its
   * contacts: the feet when standing, the hands when hanging, and the listed `contacts` when planted (hands and
   * toes in a push-up, shoulders and feet in a hip thrust).
   */
  kind: "standing" | "lying" | "seated" | "hanging" | "supported" | "planted";
  /** What the body pushes against. Standing and hanging have their own unless this replaces them. */
  contacts?: Contact[];
  /**
   * Pairs of anchors that hold one rigid thing, such as two hands on a bar. They can push or pull each other along
   * the line between them, as far as their grip on it holds, which is how a wide grip hangs from straight arms and
   * how a bench press spreads the bar.
   */
  bars?: [string, string][];
  /**
   * A held weight resting against a limb, which pushes it away square to the limb: dumbbells or a bar against the
   * thighs at the top of a deadlift, where the arms would otherwise have to hold the weight out in front. `on` is
   * the joint the limb hangs from (`hip_L` for the left thigh) and `within` how far off the limb's axis the
   * anchor sits when the two touch.
   */
  leans?: { anchor: string; on: string; within: number }[];
  /** The bar or sled rides rails, which take the horizontal force a free load would need balance for. */
  rail?: boolean;
  /** Which feet carry standing balance (`["L", "R"]` default; `["L"]` for single-leg standing). */
  feet?: Side[];
  /** Joints carried by a bench, seat, pad, or floor, so their muscles hold no load. */
  passive?: string[];
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
  /**
   * Pose the rep by least muscle effort: the goals say only what the lifter touches, holds and has to reach, and
   * every pose between is whatever costs the muscles least under the load while the task moves from the start key
   * to the end key. Without it the poses are a blend of the two keys, pulled onto the goals.
   */
  effort?: boolean;
  /**
   * What the lifter holds still through an effort-posed rep, each as a number read off the pose: a torso's lean,
   * a stance. Least effort picks the value, once for the whole rep, where a pose left to itself would drift to
   * whatever is cheapest at each instant.
   */
  steady?: ((frame: Frame) => number)[];
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
  glbState?: (frame: Frame, extras: number[], propStates: PropState[]) => GlbNodePose[][];
  machineIds?: string[];
  loads: LoadAttachment[];
  support: Support;
  tempo: Tempo;
  /** Equipment or prop id prefix to the body capsules allowed to touch it, with the depth each may press in. */
  contacts: Record<string, Record<string, number>>;
  required: RequiredContact[];
  checks: FormCheck[];
  laterality?: Laterality;
  /** What each hand holds; the grasped handle sets that hand's finger pose and is what QA measures the hand against. */
  grasps?: Grasp[];
  /** Finger pose for hands that hold nothing (`open`, `flat-floor`, `relaxed`, `fist`). */
  grips?: HandGripConfig;
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
  grips: PerHandGrip;
  grasps?: Grasp[];
  machineIds?: string[];
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
  glbStates?: GlbNodePose[][][];
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
/** How many poses an effort-posed rep is solved at between its two keys. */
const KNOTS = 12;
/**
 * How many times every knot is relaxed toward its neighbours at most, sweeping one way and then the other. The
 * path closes about a twelfth of what is left each pass, so a pulldown settles in about 25.
 */
const RELAXATIONS = 30;
/** The path has settled once a sweep each way moves no joint of any knot by more than this, in radians. */
const SETTLED = 0.01;
/** What a radian away from the knot before costs while the path is first grown, which only keeps it in one piece. */
const PATH_CONTINUITY = 0.3;
/** How many scattered postures an effort-posed key is also solved from, and how far each joint is scattered, in radians. */
const KEY_STARTS = 8;
const KEY_SCATTER = 0.25;
/** How many times an effort-posed solve starts again from where it stalled. */
const RESTARTS = 4;
/** What a radian of bend in the path at a knot costs, against the effort of a muscle working flat out. */
const PATH_SMOOTHNESS = 12;
/** What a unit off its held value costs something the lifter keeps steady through the rep. */
const STEADY_WEIGHT = 40;
/** What a metre or a radian of miss on the task's progress costs at a knot. */
const TASK_WEIGHT = 300;
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
    if (load.with !== undefined && !body.anchors[load.with]) {
      throw new Error(`${spec.id}: unknown load anchor "${load.with}".`);
    }
    if (!Number.isFinite(load.share) || load.share < 0) {
      throw new Error(`${spec.id}: invalid load share ${load.share} on ${load.anchor}.`);
    }
  }
  if (built.support.kind === "planted" && !built.support.contacts?.length) {
    throw new Error(`${spec.id}: a planted lifter needs the contacts that hold it up.`);
  }
  for (const contact of built.support.contacts ?? []) {
    for (const anchor of contact.anchors) {
      if (!body.anchors[anchor]) throw new Error(`${spec.id}: unknown contact anchor "${anchor}".`);
    }
    if (contact.share !== undefined && (!Number.isFinite(contact.share) || contact.share < 0)) {
      throw new Error(`${spec.id}: invalid contact share ${contact.share}.`);
    }
  }
  for (const anchor of (built.support.bars ?? []).flat()) {
    if (!body.anchors[anchor]) throw new Error(`${spec.id}: unknown bar anchor "${anchor}".`);
  }
  for (const lean of built.support.leans ?? []) {
    if (!body.anchors[lean.anchor]) throw new Error(`${spec.id}: unknown lean anchor "${lean.anchor}".`);
    if (body.index[lean.on] === undefined) throw new Error(`${spec.id}: unknown lean limb "${lean.on}".`);
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
  const grips = resolveGrips(spec.id, built.grasps ?? [], built.grips);
  if (built.tethers?.length && !built.tetherState) {
    throw new Error(`${spec.id}: tethers need a tetherState that places them every frame`);
  }
  for (const grasp of built.grasps ?? []) {
    const prop = built.props.find((p) => p.id === grasp.prop);
    if (grasp.prop && !prop) throw new Error(`${spec.id}: grasp ${grasp.side} holds unknown prop "${grasp.prop}"`);
    // The fingers close on the handle's listed radius; a scaled GLB would thicken the handle under them.
    if (prop?.kind === "glb" && prop.scale !== undefined && prop.scale !== 1) {
      throw new Error(`${spec.id}: grasped prop "${prop.id}" is scaled; hands can only hold canonical-size props`);
    }
  }

  const n = body.dofCount;
  const selfPairs = selfCollisionPairs(body);
  const allowFor = (partId: string) => {
    const merged: Record<string, number> = {};
    for (const [prefix, map] of Object.entries(built.contacts)) if (partId.startsWith(prefix)) Object.assign(merged, map);
    return merged;
  };
  // Props are placed from the pose, so the solver sees them where they'll be drawn and keeps limbs out of them.
  const propColliders = built.props.map((prop) =>
    propParts(prop, spec.defaultLoadKg)
      .filter((part) => part.collide)
      .map((part) => ({ part, allow: allowFor(part.id) })),
  );
  const movingObstacles = propColliders.some((parts) => parts.length)
    ? (frame: Frame, q: Float64Array): Obstacle[] => {
        const states = built.propState(frame, [...q.subarray(n)]);
        return propColliders.flatMap((parts, i) =>
          parts.length ? compileParts(parts.map((p) => p.part), states[i]).map((shape, k) => ({ shape, allow: parts[k].allow })) : [],
        );
      }
    : undefined;
  const withExtras = (pose: Float64Array, extras: number[]) => {
    const q = new Float64Array(n + built.extras);
    q.set(pose);
    extras.forEach((value, i) => (q[n + i] = value));
    return q;
  };

  const free = priorWeights(body, built.stiffness, built.extras, 0);
  const seedOnly = new Float64Array(n + built.extras).fill(0.02);
  const everyPose = built.effort
    ? [
        ...built.goals,
        ...cablesTaut(body, built.loads),
        ...handsAlongLoads(body, built.loads),
        leastEffort(body, built, spec.defaultLoadKg),
      ]
    : built.goals;
  // Muscle effort has creases where a muscle switches on or a contact lets go, and a solve can stall on one. Starting
  // again from where it stalled gets it across, so an effort-posed solve repeats until it stops finding anything.
  const settleFrom = (seed: Float64Array, options: Parameters<typeof solve>[2]) => {
    let best = solve(body, seed, options);
    for (let again = 0; built.effort && again < RESTARTS; again++) {
      const next = solve(body, best.q, options);
      const gained = best.cost - next.cost;
      if (next.cost < best.cost) best = next;
      if (gained < 1e-4 * (1 + best.cost)) break;
    }
    return best;
  };
  // A posture is a basin, and the nearest one is not always the cheapest: hanging back off a cable on the lower
  // back and reaching forward to it on the lats are both places a solve can come to rest. Trying the neighbouring
  // knots' postures as starting points lets the cheaper one spread along the path.
  const settle = (seed: Float64Array, options: Parameters<typeof solve>[2], others: Float64Array[] = []) => {
    let best = settleFrom(seed, options);
    for (const other of others) {
      // A start can be a posture some goal refuses outright, such as a bar turned end-on to an overhand grip.
      let tried: ReturnType<typeof settleFrom>;
      try {
        tried = settleFrom(other, options);
      } catch {
        continue;
      }
      if (tried.cost < best.cost * (1 - 1e-3)) best = tried;
    }
    return best.q;
  };
  const solveKey = (
    hints: PoseHints,
    goals: Goal[],
    extraSeed = built.extraStart,
    label = "key",
    seed?: Float64Array,
  ) => {
    const prior = withExtras(makePose(body, hints), extraSeed);
    // An effort-posed key takes its hints as a place to start and nothing more, and starts from several postures
    // scattered around them: the hinted one may sit in a costlier basin than its neighbour. The scatter is the
    // same every run.
    const scattered: Float64Array[] = [];
    if (built.effort) {
      let state = 0x9e3779b9;
      const random = () => {
        state = (state + 0x6d2b79f5) | 0;
        let v = Math.imul(state ^ (state >>> 15), 1 | state);
        v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
        return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
      };
      for (let s = 0; s < KEY_STARTS; s++) {
        const other = Float64Array.from(seed ?? prior);
        for (let d = 3; d < n; d++) other[d] += (random() * 2 - 1) * (d < 6 ? KEY_SCATTER / 3 : KEY_SCATTER);
        scattered.push(other);
      }
    }
    const solved = settle(
      seed ?? prior,
      {
        goals: [...everyPose, ...goals],
        prior,
        priorWeights: built.effort ? seedOnly : free,
        selfPairs,
        obstacles: built.obstacles,
        movingObstacles,
        iterations: 150,
      },
      scattered,
    );
    assertFiniteArray(`${spec.id} ${label} pose`, solved);
    return solved;
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
            movingObstacles,
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
    const hasProgressSpan = !built.isometric && Math.abs(to - from) > 0.015;

    const samples: Float64Array[] = [];
    if (built.effort) {
      // Each knot holds the task at its share of the way from the start to the end and is otherwise free to take
      // the cheapest pose. Relaxing every knot toward the midpoint of its neighbours, forward then back, is what
      // makes the path one motion: a knot alone would jump to a cheaper posture the moment the task allowed it.
      const smooth = new Float64Array(n + built.extras).fill(PATH_SMOOTHNESS);
      smooth.fill(200, n);
      const taskAt = (k: number): Goal => {
        const target = from + ((to - from) * k) / KNOTS;
        return ({ frame, push }) => push(TASK_WEIGHT * (built.progress(frame) - target));
      };
      const loose = new Float64Array(n + built.extras).fill(PATH_CONTINUITY);
      loose.fill(200, n);
      const steady = built.steady ?? [];
      const held = steady.map(() => 0);
      const holdSteady: Goal = ({ frame, push }) =>
        steady.forEach((read, i) => push(STEADY_WEIGHT * (read(frame) - held[i])));
      const relax = (
        k: number,
        seed: Float64Array,
        prior: Float64Array,
        weights = smooth,
        hold = true,
        others: Float64Array[] = [],
      ) => {
        path(k / KNOTS, startExtras, endExtras).forEach((value, e) => (prior[n + e] = value));
        const ends = k === 0 ? built.keyGoals.start : k === KNOTS ? built.keyGoals.end : [taskAt(k)];
        const solved = settle(
          seed,
          {
            goals: [...everyPose, ...ends, ...(hold ? [holdSteady] : [])],
            prior,
            priorWeights: weights,
            selfPairs,
            obstacles: built.obstacles,
            movingObstacles,
          },
          others,
        );
        assertFiniteArray(`${spec.id} knot[${k}]`, solved);
        return solved;
      };
      // Each knot starts from the one before it and is held to it only loosely, so the path grows out of the start
      // pose in one piece and each knot finds its own cheapest posture. A blend of the two keys' joint angles
      // would start the middle of the rep somewhere no lifter passes through.
      samples.push(start);
      for (let k = 1; k < KNOTS; k++)
        samples.push(relax(k, samples[k - 1], Float64Array.from(samples[k - 1]), loose, false));
      // The end key is solved again from where the path arrives, so the path and its end are the same posture.
      end = solveKey(built.hints.end, built.keyGoals.end, built.extraStart, "end", samples[KNOTS - 1]);
      samples.push(end);
      let moved = [Infinity, Infinity];
      for (let pass = 0; pass < RELAXATIONS && Math.max(...moved) > SETTLED; pass++) {
        const before = samples.map((pose) => Float64Array.from(pose));
        // What is held steady is held at its average over the path so far, which settles as the passes go on.
        steady.forEach((read, i) => {
          held[i] = samples.reduce((sum, pose) => sum + read(fk(body, pose, scratch)), 0) / samples.length;
        });
        for (let i = 0; i <= KNOTS; i++) {
          const k = pass % 2 === 0 ? i : KNOTS - i;
          // The two ends are the task itself: they answer to their own goals and to what is held steady, and the
          // path between is what bends to meet them.
          if (k === 0 || k === KNOTS) {
            const inward = samples[k === 0 ? 1 : KNOTS - 1];
            samples[k] = relax(k, samples[k], Float64Array.from(samples[k]), loose, true, pass < 2 ? [inward] : []);
            continue;
          }
          const middle = Float64Array.from(samples[k - 1], (value, d) => (value + samples[k + 1][d]) / 2);
          const came = samples[pass % 2 === 0 ? k - 1 : k + 1];
          samples[k] = relax(k, samples[k], middle, smooth, true, pass < 2 ? [came] : []);
        }
        let most = 0;
        samples.forEach((pose, k) => pose.forEach((value, d) => (most = Math.max(most, Math.abs(value - before[k][d])))));
        moved = [moved[1], most];
      }
      start = samples[0];
      end = samples[KNOTS];
    }
    for (let i = 0; !built.effort && i <= SAMPLES; i++) {
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
        movingObstacles,
      }).q;
      assertFiniteArray(`${spec.id} sample[${i}]`, solved);
      samples.push(solved);
    }

    const last = samples.length - 1;
    const poseAt = (u: number) => {
      const x = Math.min(Math.max(u, 0), 1) * last;
      const i = Math.min(Math.floor(x), last - 1);
      const t = x - i;
      const p0 = samples[Math.max(i - 1, 0)];
      const p1 = samples[i];
      const p2 = samples[i + 1];
      const p3 = samples[Math.min(i + 2, last)];
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
  for (const prop of built.props) {
    if (prop.kind === "parts") for (const part of prop.parts) partIds.add(part.id);
    else if (prop.kind === "glb" && prop.colliders) for (const part of prop.colliders) partIds.add(part.id);
  }
  for (const contact of built.required) {
    if (contact.part && !partIds.has(contact.part)) {
      throw new Error(
        `${spec.id}: required contact "${contact.label}" references missing equipment part "${contact.part}". Available: ${[...partIds].join(", ")}`,
      );
    }
  }

  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  const glbStates =
    built.glb?.length && built.glbState
      ? poses.map((pose, f) =>
          built.glbState!(fk(body, pose, frame), [...pose.subarray(n)], propStates[f]).map((arr) =>
            arr.map((np) => ({
              node: np.node,
              ...(np.posOffset ? { posOffset: np.posOffset.map(round) as Vec3 } : {}),
              ...(np.pos ? { pos: np.pos.map(round) as Vec3 } : {}),
              ...(np.rotOffset ? { rotOffset: np.rotOffset.map(round) as Vec3 } : {}),
              ...(np.quat
                ? { quat: np.quat.map(round) as [number, number, number, number] }
                : {}),
            })),
          ),
        )
      : undefined;
  // A weight stack rests on its pins when the cable is slackest, wherever the author measured the cable's rest length.
  if (glbStates) {
    for (let g = 0; g < glbStates[0].length; g++) {
      for (const node of new Set(glbStates[0][g].filter((p) => p.node.startsWith("stack")).map((p) => p.node))) {
        const lift = (f: number) => glbStates[f][g].find((p) => p.node === node)?.posOffset?.[1] ?? 0;
        const rest = Math.min(...glbStates.map((_, f) => lift(f)));
        for (const row of glbStates) {
          const pose = row[g].find((p) => p.node === node);
          if (pose?.posOffset) pose.posOffset = [pose.posOffset[0], round(pose.posOffset[1] - rest), pose.posOffset[2]];
        }
      }
    }
  }
  const sequence: Sequence = {
    id: spec.id,
    catalogId: spec.catalogId,
    name: spec.name,
    fps: FPS,
    lifter: { height: body.height, mass: body.mass },
    loadKg: spec.defaultLoadKg,
    loadUnit: spec.loadUnit,
    laterality: built.laterality ?? spec.laterality ?? "bilateral",
    grips,
    ...(built.grasps?.length ? { grasps: built.grasps } : {}),
    ...(built.machineIds?.length ? { machineIds: built.machineIds } : {}),
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
    ...(glbStates ? { glbStates } : {}),
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
