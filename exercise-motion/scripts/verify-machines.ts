#!/usr/bin/env bun
/**
 * Validates every canonical GLB in models/machines against the semantic material standard and its
 * anchors, then builds every TypeScript factory across representative states.
 *
 *   bun exercise-motion/scripts/verify-machines.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Matrix4, Quaternion, Vector3 } from "three";
import { SEMANTIC_MATERIALS } from "../src/contracts";
import type { Part } from "../src/equipment";
import type { Vec3 } from "../src/math";
import {
  adjustableBenchMachine,
  cableAttachment,
  CABLE_ATTACHMENTS,
  chestPressMachine,
  dualAdjustablePulleyMachine,
  dumbbellProp,
  abWheelProp,
  kettlebellProp,
  landmineMachine,
  loadedBar,
  stabilityBallProp,
  legExtensionMachine,
  legPress45Machine,
  loadedBarbell,
  loadedEzBar,
  MACHINE_SKINS,
  MACHINES,
  medicineBallProp,
  plyoBoxMachine,
  powerRackMachine,
  propHandles,
  seatedLegCurlMachine,
  smithMachineMachine,
  SPECS,
  type MachineInstance,
} from "../src/machines";
import { MOTION_ROOT } from "./catalog-io";

const DIR = join(MOTION_ROOT, "models", "machines");
const MAX_TRIS = 30_000;
const MAX_BYTES = 1_500_000;
const errors: string[] = [];
const fail = (msg: string): void => {
  errors.push(msg);
};

interface Gltf {
  nodes: { name?: string; mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorTexture?: unknown } }[];
  accessors: { min?: number[]; max?: number[]; count: number }[];
  scenes: { nodes: number[] }[];
  images?: unknown[];
  textures?: unknown[];
  extensionsUsed?: string[];
}

function readGlb(path: string): Gltf {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const len = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${path}: first chunk is not JSON`);
  return JSON.parse(buf.subarray(20, 20 + len).toString("utf8")) as Gltf;
}

function glbBounds(g: Gltf) {
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  let tris = 0;
  const visit = (i: number, parent: Matrix4) => {
    const n = g.nodes[i];
    const m = parent
      .clone()
      .multiply(
        new Matrix4().compose(
          new Vector3(...((n.translation ?? [0, 0, 0]) as Vec3)),
          new Quaternion(...((n.rotation ?? [0, 0, 0, 1]) as [number, number, number, number])),
          new Vector3(...((n.scale ?? [1, 1, 1]) as Vec3)),
        ),
      );
    if (n.mesh !== undefined) {
      for (const prim of g.meshes[n.mesh].primitives) {
        const acc = g.accessors[prim.attributes.POSITION];
        if (!acc.min || !acc.max) throw new Error("POSITION accessor without min/max");
        for (const x of [acc.min[0], acc.max[0]])
          for (const y of [acc.min[1], acc.max[1]])
            for (const z of [acc.min[2], acc.max[2]]) {
              const p = new Vector3(x, y, z).applyMatrix4(m);
              lo.min(p);
              hi.max(p);
            }
        tris += (prim.indices !== undefined ? g.accessors[prim.indices].count : acc.count) / 3;
      }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  for (const root of g.scenes[0].nodes) visit(root, new Matrix4());
  return { lo, hi, tris };
}

function checkGlb(file: string) {
  const id = file.replace(/\.glb$/, "");
  const spec = SPECS[id];
  const path = join(DIR, file);
  const bytes = statSync(path).size;
  if (!spec) {
    fail(`${file}: no anchors.json entry (stale file?)`);
    return undefined;
  }
  const g = readGlb(path);
  const names = new Set<string>();
  for (const m of g.materials ?? []) {
    if (!m.name || !(SEMANTIC_MATERIALS as readonly string[]).includes(m.name)) fail(`${id}: non-semantic material "${m.name}"`);
    if (m.pbrMetallicRoughness?.baseColorTexture) fail(`${id}: material ${m.name} has a texture`);
    names.add(m.name ?? "");
  }
  if (names.size !== (g.materials ?? []).length) fail(`${id}: duplicate material names`);
  if (g.images?.length || g.textures?.length) fail(`${id}: has images/textures`);
  if (g.extensionsUsed?.length) fail(`${id}: uses extensions ${g.extensionsUsed.join(", ")}`);
  for (const mesh of g.meshes) for (const p of mesh.primitives) if (p.material === undefined) fail(`${id}: primitive without material`);
  const nodeNames = new Set(g.nodes.map((n) => n.name));
  for (const node of Object.keys(spec.nodes)) if (!nodeNames.has(node)) fail(`${id}: missing articulated node "${node}"`);
  if (!nodeNames.has(id)) fail(`${id}: missing root node named after the machine`);
  const { lo, hi, tris } = glbBounds(g);
  if (tris > MAX_TRIS) fail(`${id}: ${tris} tris > ${MAX_TRIS}`);
  if (bytes > MAX_BYTES) fail(`${id}: ${bytes} bytes > ${MAX_BYTES}`);
  if (Math.round(tris) !== spec.tris) fail(`${id}: GLB has ${tris} tris, anchors say ${spec.tris}`);
  const anchorLo = new Vector3(...(spec.bounds.min as Vec3));
  const anchorHi = new Vector3(...(spec.bounds.max as Vec3));
  if (lo.distanceTo(anchorLo) > 0.002 || hi.distanceTo(anchorHi) > 0.002) fail(`${id}: GLB bounds drift from anchors.json`);
  if (spec.kind === "machine") {
    if (Math.abs(lo.y) > 0.001) fail(`${id}: min y ${lo.y.toFixed(4)} is not on the floor`);
    const cx = (lo.x + hi.x) / 2;
    if (Math.abs(cx) > 0.001 && !spec.params.asymmetric) fail(`${id}: center x ${cx.toFixed(4)} is not 0`);
  }
  // Every collider must sit inside the mesh's bounds: colliders are measured off the same geometry.
  for (const p of spec.parts) {
    const c = new Vector3(...(p.pos as Vec3));
    if (c.x < lo.x - 0.01 || c.y < lo.y - 0.01 || c.z < lo.z - 0.01 || c.x > hi.x + 0.01 || c.y > hi.y + 0.01 || c.z > hi.z + 0.01)
      fail(`${id}: part ${p.id} lies outside the mesh`);
  }
  return { id, kind: spec.kind, tris, bytes, materials: names.size, nodes: Object.keys(spec.nodes).length, parts: spec.parts.length };
}

const finite = (v: number[]) => v.every(Number.isFinite);

function checkInstance(label: string, m: MachineInstance<object>) {
  if (m.glb.length !== 1 || !m.glb[0].id.startsWith("machines/") || !m.glb[0].hideEquipment) fail(`${label}: bad glb ref`);
  if (!existsSync(join(MOTION_ROOT, "models", `${m.glb[0].id}.glb`))) fail(`${label}: glb file missing`);
  const check = (what: string, v: number[]) => !finite(v) && fail(`${label}: non-finite ${what}`);
  m.equipment.forEach((p: Part) => {
    check(p.id, [...p.pos, ...p.quat, ...p.size]);
    if (!p.id.startsWith(`${m.id}.`)) fail(`${label}: part id ${p.id} lacks the machine prefix`);
  });
  for (const [k, h] of Object.entries(m.handles ?? {})) check(`handle ${k}`, [...h.pos, ...h.axis, ...h.palmNormal]);
  for (const [k, s] of Object.entries(m.surfaces ?? {})) check(`surface ${k}`, [...s.origin, ...s.normal, ...s.up]);
  for (const [k, p] of Object.entries(m.pulleys ?? {})) check(`pulley ${k}`, [...p.pos, ...p.exitDir]);
  const poses = m.glbState!({ pos: [], rot: [] }, [], []);
  const spec = SPECS[m.id];
  for (const pose of poses[0]) {
    if (!spec.nodes[pose.node]) fail(`${label}: pose for unknown node ${pose.node}`);
    check(`pose ${pose.node}`, [...(pose.posOffset ?? []), ...(pose.rotOffset ?? [])]);
  }
  for (const prefix of Object.keys(m.contacts)) {
    if (!m.equipment.some((p) => p.id.startsWith(prefix))) fail(`${label}: contact key ${prefix} matches no part`);
  }
}

const near = (a: Vec3, b: Vec3, tol = 0.003) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tol;

function kinematics() {
  const flat = adjustableBenchMachine();
  const incline = adjustableBenchMachine({ backAngleDeg: 45 });
  const n = incline.surfaces!.back.normal;
  if (!near(n, [0, Math.SQRT1_2, Math.SQRT1_2])) fail(`adjustable-bench @45: back normal ${n}`);
  if (!near(flat.surfaces!.back.normal, [0, 1, 0])) fail("adjustable-bench flat: back normal not up");
  // The strut foot must land on the ladder (y = 0.31) at every incline.
  for (const deg of [0, 30, 45, 60, 85]) {
    const b = adjustableBenchMachine({ backAngleDeg: deg });
    const foot = b.pointAt([0, 0.33, -0.65], "back_strut");
    if (Math.abs(foot[1] - 0.31) > 0.005 && deg > 0) fail(`adjustable-bench @${deg}: strut foot at y ${foot[1].toFixed(3)}`);
  }
  const rack = powerRackMachine({ hookY: 1.1, safetyY: 0.5 });
  if (Math.abs(rack.hooks![0].pos[1] - 1.1) > 1e-6) fail("power-rack: hook did not move to 1.1");
  const lp0 = legPress45Machine({ sledTravel: 0 }).footplates!.sled.surface.origin;
  const lp1 = legPress45Machine({ sledTravel: 0.5 }).footplates!.sled.surface.origin;
  const d = [lp1[0] - lp0[0], lp1[1] - lp0[1], lp1[2] - lp0[2]];
  if (!near(d as Vec3, [0, 0.5 * Math.SQRT1_2, 0.5 * Math.SQRT1_2])) fail(`leg-press-45: sled moved ${d}`);
  const smith = smithMachineMachine({ barY: 0.9 });
  if (Math.abs(smith.handles!.bar.pos[1] - 0.9) > 1e-6) fail("smith-machine: bar did not move");
  const ext = legExtensionMachine({ extensionDeg: 80 }).surfaces!.ankle_pad.origin;
  const ext0 = legExtensionMachine().surfaces!.ankle_pad.origin;
  if (!(ext[1] > ext0[1] + 0.25 && ext[2] > ext0[2])) fail("leg-extension: ankle pad did not swing forward and up");
  const curl = seatedLegCurlMachine({ curlDeg: 90 }).surfaces!.calf_pad.origin;
  if (!(curl[2] < 0.3)) fail("seated-leg-curl: calf pad did not swing under the seat");
  const press = chestPressMachine({ pressDeg: 27 }).handles!.handle_L.pos;
  if (!(press[2] > 0.55 && Math.abs(press[1] - 1.0) < 0.05)) fail(`chest-press: handle at ${press}`);
  const pulley = dualAdjustablePulleyMachine({ pulleyY: 1.9 }).pulleys!.pulley_L.pos;
  if (Math.abs(pulley[1] - 1.9) > 1e-6) fail("dual-adjustable-pulley: pulley height");
  const driven = dualAdjustablePulleyMachine({ handles: () => ({ L: [0.2, 1.2, 0.6], R: [-0.2, 1.2, 0.6] }) });
  const poses = driven.glbState!({ pos: [], rot: [] }, [], [])[0];
  const stack = poses.find((p) => p.node === "stack_L")!.posOffset![1];
  if (!(stack > 0.05)) fail(`dual-adjustable-pulley: driven stack lift ${stack}`);
  for (const h of [0.51, 0.61, 0.76] as const) {
    const box = plyoBoxMachine({ height: h }).surfaces!.top.origin;
    if (Math.abs(box[1] - h) > 1e-6) fail(`plyo-box: top at ${box[1]} for height ${h}`);
  }
  const mine = landmineMachine({ barEnd: () => [0.3, 1.0, -1.4] });
  const lm = mine.glbState!({ pos: [], rot: [] }, [], [])[0];
  const yaw = lm.find((p) => p.node === "yaw")!.rotOffset![1];
  const pitch = lm.find((p) => p.node === "sleeve")!.rotOffset![0];
  if (!(yaw < 0 && pitch > 0.4)) fail(`landmine: aim yaw ${yaw} pitch ${pitch}`);
  const placed = adjustableBenchMachine({ pos: [1, 0, 2], yawDeg: 90 });
  if (!near(placed.surfaces!.seat.origin, [1 + 0.025, 0.445, 2], 0.002)) fail(`placement: seat at ${placed.surfaces!.seat.origin}`);
}

function props() {
  const bar = loadedBarbell("bar", 100);
  if (bar.props.length !== 1 + 2 * 2) fail(`loadedBarbell 100 kg: ${bar.props.length} props`);
  const ez = loadedEzBar("ez", 30);
  const specialty = (["prop-trap-bar", "prop-safety-squat-bar", "prop-axle-bar"] as const).flatMap((g) => loadedBar(g, g, 80).props);
  for (const p of [...bar.props, ...ez.props, ...specialty, stabilityBallProp("ball"), abWheelProp("wheel"), dumbbellProp("db", 20), kettlebellProp("kb", 16), medicineBallProp("mb"), ...CABLE_ATTACHMENTS.map((k) => cableAttachment(k, k))]) {
    if (p.kind !== "glb") fail(`${p.id}: not a glb prop`);
    else if (!existsSync(join(MOTION_ROOT, "models", `${p.glbId}.glb`))) fail(`${p.id}: ${p.glbId}.glb missing`);
  }
  if (!propHandles("prop-barbell").grip) fail("prop-barbell: no grip handle");
}

const rows = readdirSync(DIR)
  .filter((f) => f.endsWith(".glb"))
  .sort()
  .map(checkGlb)
  .filter((r) => r !== undefined);
for (const spec of Object.values(SPECS)) if (!existsSync(join(DIR, `${spec.id}.glb`))) fail(`${spec.id}: anchors entry without a GLB`);
for (const [id, make] of Object.entries(MACHINES)) checkInstance(id, make() as MachineInstance<object>);
kinematics();
props();
if (MACHINE_SKINS.length < 3) fail("fewer than 3 skins");

console.log("id".padEnd(26), "kind".padEnd(8), "tris".padStart(6), "KB".padStart(5), "mats".padStart(5), "nodes".padStart(6), "parts".padStart(6));
for (const r of rows) {
  console.log(r.id.padEnd(26), r.kind.padEnd(8), String(r.tris).padStart(6), String(Math.round(r.bytes / 1024)).padStart(5), String(r.materials).padStart(5), String(r.nodes).padStart(6), String(r.parts).padStart(6));
}
const total = rows.reduce((s, r) => s + r.bytes, 0);
console.log(`\n${rows.length} GLBs (${rows.filter((r) => r.kind === "machine").length} machines), ${Math.round(total / 1024)} KB total; ${Object.keys(MACHINES).length} factories built.`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("All canonical machines verified.");
