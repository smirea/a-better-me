import { Quaternion, Vector3 } from "three";
import type { HandleSpec } from "../contracts";
import { platesFor, propParts, type BarbellStyle, type Part, type PropDef, type PropState } from "../equipment";
import type { Vec3 } from "../math";
import { machineSpec } from "./core";

/** Grip anchors of a canonical prop in its own frame (bars and handles along local X through the origin). */
export function propHandles(id: string): Record<string, HandleSpec> {
  const spec = machineSpec(id);
  if (spec.kind !== "prop") throw new Error(`${id} is not a prop`);
  const out: Record<string, HandleSpec> = {};
  for (const [k, h] of Object.entries(spec.anchors.handles ?? {})) {
    out[k] = {
      pos: h.pos as Vec3,
      axis: h.axis as Vec3,
      palmNormal: h.palmNormal as Vec3,
      radius: h.radius,
      length: h.length,
      grip: h.grip as HandleSpec["grip"],
    };
  }
  return out;
}

function specColliders(id: string, propId: string): Part[] {
  return machineSpec(id).parts.map((p) => ({
    id: `${propId}.${p.id}`,
    shape: p.shape,
    size: p.size as Vec3,
    pos: p.pos as Vec3,
    quat: p.quat as [number, number, number, number],
    material: p.material as Part["material"],
    collide: p.collide,
  }));
}

const plateGlb = (kg: number) => {
  const id = `prop-plate-${String(kg).replace(".", "_")}`;
  machineSpec(id);
  return `machines/${id}`;
};

/** A loaded bar: the bar GLB carries every collider; plates are visual-only props sharing its state. */
export interface LoadedBar {
  props: PropDef[];
  /** Expands the bar's state into one state per prop (bar first, then plates). */
  states(bar: PropState): PropState[];
}

const BAR_STYLES = {
  "prop-barbell": "straight",
  "prop-ez-bar": "ez",
  "prop-trap-bar": "trap",
  "prop-safety-squat-bar": "ssb",
  "prop-axle-bar": "axle",
} as const satisfies Record<string, BarbellStyle>;

export type BarGlb = keyof typeof BAR_STYLES;

/** Any canonical bar loaded to `loadKg` total, with plates from `platesFor` on both sleeves. */
export function loadedBar(id: string, glb: BarGlb, loadKg: number): LoadedBar {
  const spec = machineSpec(glb);
  const barKg = spec.params.barKg as number;
  const collarX = spec.params.collarX as number;
  const length = spec.params.length as number;
  const radius = spec.params.radius as number | undefined;
  const parametric: PropDef = { id, kind: "barbell", barKg, collarX, length, style: BAR_STYLES[glb], ...(radius ? { radius } : {}) };
  const bar: PropDef = { id, kind: "glb", glbId: `machines/${glb}`, colliders: propParts(parametric, loadKg) };
  const plates: PropDef[] = [];
  let x = collarX + 0.02;
  platesFor(Math.max(0, (loadKg - barKg) / 2)).forEach(([kg, , thickness], n) => {
    for (const side of [1, -1]) {
      plates.push({
        id: `${id}.plate${n}${side > 0 ? "a" : "b"}`,
        kind: "glb",
        glbId: plateGlb(kg),
        offset: [side * (x + thickness / 2), 0, 0],
        colliders: [],
      });
    }
    x += thickness + 0.002;
  });
  return {
    props: [bar, ...plates],
    states: (s) => [s, ...plates.map(() => s)],
  };
}

export const loadedBarbell = (id: string, loadKg: number) => loadedBar(id, "prop-barbell", loadKg);
export const loadedEzBar = (id: string, loadKg: number) => loadedBar(id, "prop-ez-bar", loadKg);

/** The canonical dumbbell; its colliders are the GLB's own measured parts, whatever load the exercise sets. */
export function dumbbellProp(id: string): PropDef {
  return { id, kind: "glb", glbId: "machines/prop-dumbbell", colliders: specColliders("prop-dumbbell", id) };
}

export function kettlebellProp(id: string): PropDef {
  return { id, kind: "glb", glbId: "machines/prop-kettlebell", colliders: specColliders("prop-kettlebell", id) };
}

export const CABLE_ATTACHMENTS = ["prop-d-handle", "prop-lat-bar", "prop-v-bar", "prop-rope"] as const;
export type CableAttachment = (typeof CABLE_ATTACHMENTS)[number];

export function cableAttachment(id: string, kind: CableAttachment): PropDef {
  return { id, kind: "glb", glbId: `machines/${kind}`, colliders: specColliders(kind, id) };
}

/** Where the cable clips onto an attachment, in the attachment's frame. */
export function cableEye(kind: CableAttachment): Vec3 {
  const eye = machineSpec(kind).anchors.points?.eye;
  if (!eye) throw new Error(`${kind} has no cable eye`);
  return eye.pos as Vec3;
}

/** World position of an attachment's cable eye for a prop state. */
export function cableEyeAt(kind: CableAttachment, state: PropState): Vec3 {
  const p = new Vector3(...cableEye(kind)).applyQuaternion(new Quaternion(...state.quat)).add(new Vector3(...state.pos));
  return [p.x, p.y, p.z];
}

export function medicineBallProp(id: string): PropDef {
  return { id, kind: "glb", glbId: "machines/prop-medicine-ball", colliders: specColliders("prop-medicine-ball", id) };
}

export function stabilityBallProp(id: string): PropDef {
  return { id, kind: "glb", glbId: "machines/prop-stability-ball", colliders: specColliders("prop-stability-ball", id) };
}

export function abWheelProp(id: string): PropDef {
  return { id, kind: "glb", glbId: "machines/prop-ab-wheel", colliders: specColliders("prop-ab-wheel", id) };
}
