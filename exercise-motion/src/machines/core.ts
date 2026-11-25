import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Frame, Side } from "../body";
import type {
  CanonicalMachineInstance,
  FootplateSpec,
  HandGrip,
  HandleSpec,
  PivotSpec,
  PulleySpec,
  RailSpec,
} from "../contracts";
import type { GlbNodePose, Material, Part, PropState } from "../equipment";
import type { PadSurface } from "../equipment";
import type { Carrier, Grasp } from "../grasp";
import { clamp, type Vec3 } from "../math";
import anchorsJson from "./anchors.json";

type Quat = [number, number, number, number];

interface SpecPart {
  id: string;
  shape: Part["shape"];
  size: number[];
  pos: number[];
  quat: number[];
  material: string;
  collide: boolean;
  node?: string;
}

interface Located {
  node?: string;
}

/** One entry of `anchors.json`, written by `scripts/machines/build_machines.py` from the same geometry it exports. */
export interface MachineSpec {
  id: string;
  name: string;
  kind: "machine" | "prop";
  file: string;
  facing: string;
  notes: string;
  bounds: { min: number[]; max: number[] };
  tris: number;
  bytes: number;
  materials: string[];
  params: Record<string, unknown>;
  nodes: Record<string, { pivot: number[]; parent: string | null }>;
  parts: SpecPart[];
  anchors: {
    handles?: Record<string, Located & { pos: number[]; axis: number[]; palmNormal: number[]; radius: number; length: number; grip: string }>;
    surfaces?: Record<string, Located & { origin: number[]; normal: number[]; up: number[] }>;
    footplates?: Record<string, { surface: string; width: number; minAlong: number; maxAlong: number }>;
    pulleys?: Record<string, { pos: number[]; exitDir: number[]; nodeName?: string; stackNode?: string; travelRatio: number; stackTravel: number }>;
    rails?: Record<string, { origin: number[]; dir: number[]; minTravel: number; maxTravel: number; nodeName?: string }>;
    pivots?: Record<string, { origin: number[]; axis: number[]; minAngleRad: number; maxAngleRad: number; nodeName?: string }>;
    hooks?: Record<string, Located & { pos: number[] }>;
    points?: Record<string, Located & { pos: number[] }>;
  };
}

export const SPECS: Record<string, MachineSpec> = Object.fromEntries(
  (anchorsJson as unknown as MachineSpec[]).map((s) => [s.id, s]),
);

export function machineSpec(id: string): MachineSpec {
  const spec = SPECS[id];
  if (!spec) throw new Error(`Unknown canonical machine "${id}" (anchors.json is stale? rerun build_machines.py)`);
  return spec;
}

export const specParam = (spec: MachineSpec, key: string): number => {
  const value = spec.params[key];
  if (typeof value !== "number") throw new Error(`${spec.id}: missing numeric param "${key}"`);
  return value;
};

/** Local pose of one articulated node, relative to its bind pose, in its parent's frame. */
export interface NodeState {
  posOffset?: Vec3;
  /** Euler XYZ radians about the node's pivot (bind rotation is identity for every canonical node). */
  rotOffset?: Vec3;
}

export type NodeStates = Record<string, NodeState>;

export interface Placement {
  /** World position of the machine's origin. */
  pos?: Vec3;
  /** Turn about world Y in degrees (0 keeps the lifter facing +Z). */
  yawDeg?: number;
  /** Prefix for equipment part ids and contact keys. Defaults to the machine id. */
  idPrefix?: string;
}

export type Drive<S> = (frame: Frame, extras: number[], propStates: PropState[]) => Partial<S>;

export interface MachineInstance<S> extends CanonicalMachineInstance {
  state: S;
  nodeStates: NodeStates;
  /** The same machine at another state (e.g. the start and end of a rep), same placement. */
  at(state: Partial<S>): MachineInstance<S>;
  /** World transform of a point given in bind-pose machine coordinates and attached to `node`. */
  pointAt(p: Vec3, node?: string): Vec3;
  /**
   * A hand holding handle `key`. A handle on a node that `drive` moves becomes a grasp on that node's live prop, so the
   * hand follows it every frame; hold it with `holdGrasp(body, grasp, ctx.live)`.
   */
  grasp(side: Side, key: string, grip?: HandGrip): Grasp;
  /** The machine as `drive` sets it for one frame, for anchors that move: a swivelled pulley's outlet, a lever's handle. */
  atFrame(frame: Frame, extras: number[], propStates: PropState[]): MachineInstance<S>;
  /**
   * The moving node that carries surface, footplate or handle `key` when `drive` animates it, or null when it stays
   * put. Pass it to `plantFootFlat` / `plantBothFeetOnPlate` so contacts on it ride along with the solve.
   */
  carrier(key: string): Carrier | null;
}

export interface MachineDefinition<S> {
  id: string;
  defaults: S;
  normalize?(state: S, spec: MachineSpec): S;
  nodes(state: S, spec: MachineSpec): NodeStates;
  /** Rigid transform applied before placement (e.g. which face a plyo box rests on). */
  base?(state: S, spec: MachineSpec): Matrix4;
  contacts(prefix: string): Record<string, Record<string, number>>;
  cameraHint?: CanonicalMachineInstance["cameraHint"];
  /** Last adjustments that depend on the state, e.g. which of several landing faces is on top. */
  finish?(instance: MachineInstance<S>, state: S): void;
}

const MATERIALS = new Set<Material>(["steel", "chrome", "pad", "plate", "rubber", "cable", "band", "wood", "accent"]);
const GRIPS = new Set<HandGrip>(["bar", "press", "neutral", "hook", "open", "flat-floor", "ball-stop", "pinch", "fist", "relaxed", "hang"]);

const v3 = (a: number[]): Vec3 => [a[0], a[1], a[2]];
const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z];

function nodeMatrix(spec: MachineSpec, states: NodeStates, node: string | undefined, cache: Map<string, Matrix4>): Matrix4 {
  if (!node) return new Matrix4();
  const hit = cache.get(node);
  if (hit) return hit;
  const info = spec.nodes[node];
  if (!info) throw new Error(`${spec.id}: unknown node "${node}"`);
  const parent = nodeMatrix(spec, states, info.parent ?? undefined, cache);
  const pivot = new Vector3(...v3(info.pivot));
  const s = states[node] ?? {};
  const offset = new Vector3(...(s.posOffset ?? [0, 0, 0]));
  const rot = new Matrix4().makeRotationFromEuler(new Euler(...(s.rotOffset ?? [0, 0, 0]), "XYZ"));
  const m = parent
    .clone()
    .multiply(new Matrix4().makeTranslation(pivot.clone().add(offset)))
    .multiply(rot)
    .multiply(new Matrix4().makeTranslation(pivot.clone().negate()));
  cache.set(node, m);
  return m;
}

export function defineMachine<S extends object>(def: MachineDefinition<S>) {
  const spec = machineSpec(def.id);
  for (const node of Object.keys(def.nodes(def.defaults, spec))) {
    if (!spec.nodes[node]) throw new Error(`${def.id}: definition drives unknown node "${node}"`);
  }

  return function build(options: Partial<S> & Placement & { drive?: Drive<S> } = {}): MachineInstance<S> {
    const { pos = [0, 0, 0], yawDeg = 0, idPrefix = def.id, drive, ...rest } = options as Partial<S> &
      Placement & { drive?: Drive<S> };
    const resolve = (partial: Partial<S>): S => {
      const merged = { ...def.defaults, ...partial } as S;
      return def.normalize ? def.normalize(merged, spec) : merged;
    };
    const placement = new Matrix4()
      .makeTranslation(new Vector3(...pos))
      .multiply(new Matrix4().makeRotationY((yawDeg * Math.PI) / 180));

    const make = (state: S): MachineInstance<S> => {
      const nodeStates = def.nodes(state, spec);
      const world = placement.clone().multiply(def.base ? def.base(state, spec) : new Matrix4());
      const cache = new Map<string, Matrix4>();
      const full = (node?: string) => world.clone().multiply(nodeMatrix(spec, nodeStates, node, cache));
      const rotOf = (node?: string) => new Quaternion().setFromRotationMatrix(full(node));
      const point = (p: number[], node?: string): Vec3 => tuple(new Vector3(...v3(p)).applyMatrix4(full(node)));
      const dir = (d: number[], node?: string): Vec3 => tuple(new Vector3(...v3(d)).applyQuaternion(rotOf(node)).normalize());

      const animatedSet = drive ? new Set(Object.keys(nodeStates)) : null;
      const isAnimatedNode = (node?: string): string | null => {
        if (!animatedSet || !node) return null;
        let cur: string | null | undefined = node;
        while (cur) {
          if (animatedSet.has(cur)) return node;
          cur = spec.nodes[cur]?.parent;
        }
        return null;
      };

      const equipment: Part[] = [];
      const animatedByNode = new Map<string, Part[]>();
      for (const p of spec.parts) {
        if (!MATERIALS.has(p.material as Material)) throw new Error(`${spec.id}: bad part material ${p.material}`);
        const animNode = isAnimatedNode(p.node);
        if (animNode) {
          const pivot = spec.nodes[animNode].pivot;
          const localPart: Part = {
            id: `${idPrefix}.${p.id}`,
            shape: p.shape,
            size: v3(p.size),
            pos: [p.pos[0] - pivot[0], p.pos[1] - pivot[1], p.pos[2] - pivot[2]],
            quat: [...(p.quat as Quat)],
            material: p.material as Material,
            collide: p.collide,
            owner: idPrefix,
          };
          const list = animatedByNode.get(animNode);
          if (list) list.push(localPart);
          else animatedByNode.set(animNode, [localPart]);
          continue;
        }
        const q = rotOf(p.node).multiply(new Quaternion(...(p.quat as Quat)));
        equipment.push({
          id: `${idPrefix}.${p.id}`,
          shape: p.shape,
          size: v3(p.size),
          pos: point(p.pos, p.node),
          quat: [q.x, q.y, q.z, q.w],
          material: p.material as Material,
          collide: p.collide,
          owner: idPrefix,
        });
      }

      const animatedNodeOrder = [...animatedByNode.keys()];
      const dynamicProps = animatedNodeOrder.map((node) => ({
        id: `${idPrefix}.${node}`,
        kind: "parts" as const,
        parts: animatedByNode.get(node)!,
        hidden: true,
      }));
      const dynamicPropState =
        drive && dynamicProps.length > 0
          ? (frame: Frame, extras: number[], propStates: PropState[] = []): PropState[] => {
              const nextState = resolve({ ...state, ...drive(frame, extras, propStates) });
              const ns = def.nodes(nextState, spec);
              const nextWorld = placement.clone().multiply(def.base ? def.base(nextState, spec) : new Matrix4());
              const nextCache = new Map<string, Matrix4>();
              return animatedNodeOrder.map((node) => {
                const m = nextWorld.clone().multiply(nodeMatrix(spec, ns, node, nextCache));
                const pivot = new Vector3(...v3(spec.nodes[node].pivot)).applyMatrix4(m);
                const q = new Quaternion().setFromRotationMatrix(m);
                return { pos: tuple(pivot), quat: [q.x, q.y, q.z, q.w] };
              });
            }
          : undefined;

      const a = spec.anchors;
      const surfaces: Record<string, PadSurface> = {};
      for (const [k, s] of Object.entries(a.surfaces ?? {})) {
        surfaces[k] = {
          origin: point(s.origin, s.node),
          normal: dir(s.normal, s.node),
          up: dir(s.up, s.node),
          left: dir([1, 0, 0], s.node),
        };
      }
      const footplates: Record<string, FootplateSpec> = {};
      for (const [k, f] of Object.entries(a.footplates ?? {})) {
        footplates[k] = { surface: surfaces[f.surface], width: f.width, minAlong: f.minAlong, maxAlong: f.maxAlong };
      }
      const handles: Record<string, HandleSpec> = {};
      for (const [k, h] of Object.entries(a.handles ?? {})) {
        if (!GRIPS.has(h.grip as HandGrip)) throw new Error(`${spec.id}: bad grip ${h.grip}`);
        handles[k] = {
          pos: point(h.pos, h.node),
          axis: dir(h.axis, h.node),
          palmNormal: dir(h.palmNormal, h.node),
          radius: h.radius,
          length: h.length,
          grip: h.grip as HandGrip,
        };
      }
      const pulleys: Record<string, PulleySpec> = {};
      for (const [k, p] of Object.entries(a.pulleys ?? {})) {
        const node = p.nodeName;
        pulleys[k] = {
          pos: point(p.pos, node),
          exitDir: dir(p.exitDir, node),
          ...(node ? { nodeName: node } : {}),
          ...(p.stackNode ? { stackNode: p.stackNode } : {}),
          travelRatio: p.travelRatio,
        };
      }
      const rails: Record<string, RailSpec> = {};
      for (const [k, r] of Object.entries(a.rails ?? {})) {
        // A rail's origin is its node's current position; travel limits stay relative to bind.
        const node = r.nodeName;
        const parent = node ? (spec.nodes[node]?.parent ?? undefined) : undefined;
        rails[k] = {
          origin: point(r.origin, parent),
          dir: dir(r.dir, parent),
          minTravel: r.minTravel,
          maxTravel: r.maxTravel,
          ...(node ? { nodeName: node } : {}),
        };
      }
      const pivots: Record<string, PivotSpec> = {};
      for (const [k, p] of Object.entries(a.pivots ?? {})) {
        const parent = p.nodeName ? (spec.nodes[p.nodeName]?.parent ?? undefined) : undefined;
        pivots[k] = {
          origin: point(p.origin, parent),
          axis: dir(p.axis, parent),
          minAngleRad: p.minAngleRad,
          maxAngleRad: p.maxAngleRad,
          ...(p.nodeName ? { nodeName: p.nodeName } : {}),
        };
      }
      const hooks = Object.values(a.hooks ?? {}).map((h) => ({ pos: point(h.pos, h.node) }));

      const quat = new Quaternion().setFromRotationMatrix(world);
      const origin = new Vector3().setFromMatrixPosition(world);
      const poses = (ns: NodeStates): GlbNodePose[] =>
        Object.entries(ns).map(([node, s]) => ({
          node,
          posOffset: s.posOffset ?? [0, 0, 0],
          rotOffset: s.rotOffset ?? [0, 0, 0],
        }));
      const staticPoses = poses(nodeStates);

      const instance: MachineInstance<S> = {
        id: spec.id,
        name: spec.name,
        state,
        nodeStates,
        glb: [{ id: spec.file, pos: tuple(origin), quat: [quat.x, quat.y, quat.z, quat.w], hideEquipment: true }],
        equipment,
        ...(dynamicProps.length ? { props: dynamicProps, propState: dynamicPropState } : {}),
        contacts: def.contacts(idPrefix),
        surfaces,
        footplates,
        handles,
        pulleys,
        rails,
        pivots,
        hooks,
        glbState: drive
          ? (frame, extras, propStates) => [poses(def.nodes(resolve({ ...state, ...drive(frame, extras, propStates) }), spec))]
          : () => [staticPoses],
        ...(def.cameraHint ? { cameraHint: def.cameraHint } : {}),
        at: (next) => make(resolve({ ...state, ...next })),
        atFrame: (frame, extras, propStates) => (drive ? make(resolve({ ...state, ...drive(frame, extras, propStates) })) : instance),
        carrier: (key) => {
          const node =
            a.surfaces?.[key]?.node ??
            (a.footplates?.[key] ? a.surfaces?.[a.footplates[key].surface]?.node : undefined) ??
            a.handles?.[key]?.node;
          if (!a.surfaces?.[key] && !a.footplates?.[key] && !a.handles?.[key]) {
            throw new Error(`${spec.id}: no surface, footplate or handle "${key}"`);
          }
          const moving = isAnimatedNode(node);
          if (!moving) return null;
          const m = full(moving);
          const pivot = new Vector3(...v3(spec.nodes[moving].pivot)).applyMatrix4(m);
          const q = new Quaternion().setFromRotationMatrix(m);
          return { prop: `${idPrefix}.${moving}`, bind: { pos: tuple(pivot), quat: [q.x, q.y, q.z, q.w] } };
        },
        grasp: (side, key, grip) => {
          const raw = a.handles?.[key];
          const handle = handles[key];
          if (!raw || !handle) throw new Error(`${spec.id}: no handle "${key}" (has ${Object.keys(handles).join(", ")})`);
          const moving = isAnimatedNode(raw.node);
          if (!moving) return { side, handle, grip: grip ?? handle.grip, orient: true };
          const pivot = spec.nodes[moving].pivot;
          return {
            side,
            prop: `${idPrefix}.${moving}`,
            handle: {
              ...handle,
              pos: [raw.pos[0] - pivot[0], raw.pos[1] - pivot[1], raw.pos[2] - pivot[2]],
              axis: v3(raw.axis),
              palmNormal: v3(raw.palmNormal),
            },
            grip: grip ?? handle.grip,
            orient: true,
          };
        },
        pointAt: (p, node) => point(p, node),
      };
      def.finish?.(instance, state);
      return instance;
    };

    return make(resolve(rest as Partial<S>));
  };
}

// ---------------------------------------------------------------------------
// Shared kinematics helpers
// ---------------------------------------------------------------------------

export const rotX = (rad: number): NodeState => ({ rotOffset: [rad, 0, 0] });
export const rotY = (rad: number): NodeState => ({ rotOffset: [0, rad, 0] });
export const slideY = (dy: number): NodeState => ({ posOffset: [0, dy, 0] });
export const slideAlong = (dir: number[], t: number): NodeState => ({ posOffset: [dir[0] * t, dir[1] * t, dir[2] * t] });

/** Weight-stack lift for a cable paid out from `pulley` to `handle`, beyond `restLength`. */
export function stackLift(pulley: PulleySpec, handle: Vec3, restLength: number, maxTravel: number): number {
  const len = Math.hypot(handle[0] - pulley.pos[0], handle[1] - pulley.pos[1], handle[2] - pulley.pos[2]);
  return clamp((len - restLength) * (pulley.travelRatio ?? 1), 0, maxTravel);
}

/**
 * Yaw (radians about +Y) that turns a swivel pulley housing so its outlet faces `handle`, as the node's absolute angle
 * when `machine` is at swivel 0. Measured in the world about
 * the swivel's own pivot, so it holds for any placement yaw; the outlet sits off the pivot and swings with it.
 */
export function swivelYaw(machine: MachineInstance<object>, pulleyKey: string, handle: Vec3): number {
  const pulley = machine.pulleys?.[pulleyKey];
  if (!pulley?.nodeName) throw new Error(`${machine.id}: pulley "${pulleyKey}" has no swivel node`);
  const pivot = machine.pointAt(machineSpec(machine.id).nodes[pulley.nodeName].pivot as Vec3, pulley.nodeName);
  const out = Math.atan2(pulley.pos[0] - pivot[0], pulley.pos[2] - pivot[2]);
  const dx = handle[0] - pivot[0];
  const dz = handle[2] - pivot[2];
  if (Math.hypot(dx, dz) < 1e-6) return 0;
  return Math.atan2(dx, dz) - out;
}

export const BACK_PAD = { pelvis: 0.03, abdomen: 0.03, chest: 0.03, girdle: 0.03, neck: 0.02, head: 0.025 };
export const SEAT_PAD = { pelvis: 0.03, thigh_L: 0.03, thigh_R: 0.03, thighShaft_L: 0.03, thighShaft_R: 0.03 };
export const HANDS = { hand_L: 0.02, hand_R: 0.02, forearm_L: 0.01, forearm_R: 0.01 };
export const FEET = { foot_L: 0.02, foot_R: 0.02 };
export const SHINS = { shank_L: 0.03, shank_R: 0.03 };
export const THIGHS = { thigh_L: 0.03, thigh_R: 0.03, thighShaft_L: 0.03, thighShaft_R: 0.03 };
export const ARMS = { upperarm_L: 0.03, upperarm_R: 0.03, forearm_L: 0.02, forearm_R: 0.02 };
