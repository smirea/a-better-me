import { existsSync } from "node:fs";
import { join } from "node:path";
import { NodeIO, type Document, type Node as GltfNode } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { anchorPoint, type Body } from "./body";
import type { GlbNodePose, GlbRef } from "./equipment";
import type { Kinematics, Sequence } from "./exercise";
import { normalizeSemanticMaterial } from "./skin";
import { capsulesInWorld, newCapsules } from "./solver";
import type { Issue } from "./validate";

interface BvhNode {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  left: number;
  right: number;
  start: number;
  count: number;
}

interface PrimitiveMesh {
  materialName: string;
  semantic: string | null;
  /** Interleaved triangle vertices: 9 floats per triangle `[ax,ay,az, bx,by,bz, cx,cy,cz]`. */
  tris: Float32Array;
  triCount: number;
  bvh: BvhNode[];
}

interface ParsedNode {
  name: string;
  parent: number;
  localPos: [number, number, number];
  localQuat: [number, number, number, number];
  localScale: [number, number, number];
  primitives: PrimitiveMesh[];
}

interface ParsedGlb {
  nodes: ParsedNode[];
  byName: Map<string, number>;
}

const MOTION_ROOT = join(import.meta.dir, "..");
const DEFAULT_MODEL_DIRS = [
  join(MOTION_ROOT, "models"),
  join(MOTION_ROOT, "dist", "gym", "models"),
];

let ioPromise: Promise<NodeIO> | null = null;
const glbCache = new Map<string, ParsedGlb>();

async function getNodeIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      await MeshoptDecoder.ready;
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    })();
  }
  return ioPromise;
}

export function resolveGlbPath(id: string, extraDirs: string[] = []): string | null {
  const clean = id.replace(/^\/+/, "").replace(/\.glb$/i, "");
  for (const dir of [...extraDirs, ...DEFAULT_MODEL_DIRS]) {
    const candidate = join(dir, `${clean}.glb`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function buildBvh(tris: Float32Array, triCount: number): { tris: Float32Array; bvh: BvhNode[] } {
  const order = new Uint32Array(triCount);
  const centroids = new Float32Array(triCount * 3);
  const triMin = new Float32Array(triCount * 3);
  const triMax = new Float32Array(triCount * 3);

  for (let i = 0; i < triCount; i++) {
    order[i] = i;
    const o = i * 9;
    const ax = tris[o];
    const ay = tris[o + 1];
    const az = tris[o + 2];
    const bx = tris[o + 3];
    const by = tris[o + 4];
    const bz = tris[o + 5];
    const cx = tris[o + 6];
    const cy = tris[o + 7];
    const cz = tris[o + 8];
    triMin[i * 3] = Math.min(ax, bx, cx);
    triMin[i * 3 + 1] = Math.min(ay, by, cy);
    triMin[i * 3 + 2] = Math.min(az, bz, cz);
    triMax[i * 3] = Math.max(ax, bx, cx);
    triMax[i * 3 + 1] = Math.max(ay, by, cy);
    triMax[i * 3 + 2] = Math.max(az, bz, cz);
    centroids[i * 3] = (ax + bx + cx) / 3;
    centroids[i * 3 + 1] = (ay + by + cy) / 3;
    centroids[i * 3 + 2] = (az + bz + cz) / 3;
  }

  const bvh: BvhNode[] = [];
  const LEAF_SIZE = 8;

  function build(start: number, count: number): number {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let cMinX = Infinity;
    let cMinY = Infinity;
    let cMinZ = Infinity;
    let cMaxX = -Infinity;
    let cMaxY = -Infinity;
    let cMaxZ = -Infinity;

    for (let k = start; k < start + count; k++) {
      const idx = order[k] * 3;
      if (triMin[idx] < minX) minX = triMin[idx];
      if (triMin[idx + 1] < minY) minY = triMin[idx + 1];
      if (triMin[idx + 2] < minZ) minZ = triMin[idx + 2];
      if (triMax[idx] > maxX) maxX = triMax[idx];
      if (triMax[idx + 1] > maxY) maxY = triMax[idx + 1];
      if (triMax[idx + 2] > maxZ) maxZ = triMax[idx + 2];
      const cx = centroids[idx];
      const cy = centroids[idx + 1];
      const cz = centroids[idx + 2];
      if (cx < cMinX) cMinX = cx;
      if (cy < cMinY) cMinY = cy;
      if (cz < cMinZ) cMinZ = cz;
      if (cx > cMaxX) cMaxX = cx;
      if (cy > cMaxY) cMaxY = cy;
      if (cz > cMaxZ) cMaxZ = cz;
    }

    const nodeIdx = bvh.length;
    bvh.push({ minX, minY, minZ, maxX, maxY, maxZ, left: -1, right: -1, start, count });
    if (count <= LEAF_SIZE) return nodeIdx;

    const ex = cMaxX - cMinX;
    const ey = cMaxY - cMinY;
    const ez = cMaxZ - cMinZ;
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const span = axis === 0 ? ex : axis === 1 ? ey : ez;
    if (span < 1e-6) return nodeIdx;

    const midVal = (axis === 0 ? cMinX + cMaxX : axis === 1 ? cMinY + cMaxY : cMinZ + cMaxZ) * 0.5;
    let lo = start;
    let hi = start + count - 1;
    while (lo <= hi) {
      if (centroids[order[lo] * 3 + axis] < midVal) {
        lo++;
      } else {
        const tmp = order[lo];
        order[lo] = order[hi];
        order[hi] = tmp;
        hi--;
      }
    }
    let leftCount = lo - start;
    if (leftCount === 0 || leftCount === count) leftCount = Math.floor(count / 2);

    bvh[nodeIdx].left = build(start, leftCount);
    bvh[nodeIdx].right = build(start + leftCount, count - leftCount);
    bvh[nodeIdx].count = 0;
    return nodeIdx;
  }

  if (triCount > 0) build(0, triCount);

  const reordered = new Float32Array(triCount * 9);
  for (let i = 0; i < triCount; i++) {
    const src = order[i] * 9;
    const dst = i * 9;
    for (let k = 0; k < 9; k++) reordered[dst + k] = tris[src + k];
  }
  return { tris: reordered, bvh };
}

function parseDocument(doc: Document): ParsedGlb {
  const nodes: ParsedNode[] = [];
  const byName = new Map<string, number>();

  const visit = (gltfNode: GltfNode, parent: number) => {
    const t = gltfNode.getTranslation();
    const r = gltfNode.getRotation();
    const s = gltfNode.getScale();
    const primitives: PrimitiveMesh[] = [];
    const mesh = gltfNode.getMesh();

    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        // Default glTF primitive mode is 4 (TRIANGLES).
        const mode = prim.getMode();
        if (mode !== 4) continue;
        const posAcc = prim.getAttribute("POSITION");
        if (!posAcc) continue;
        const idxAcc = prim.getIndices();
        const vertCount = posAcc.getCount();
        const indexCount = idxAcc ? idxAcc.getCount() : vertCount;
        const triCount = Math.floor(indexCount / 3);
        if (triCount === 0) continue;

        const raw = new Float32Array(triCount * 9);
        const v = [0, 0, 0];
        let validTris = 0;
        for (let tIdx = 0; tIdx < triCount; tIdx++) {
          const i0 = idxAcc ? idxAcc.getScalar(tIdx * 3) : tIdx * 3;
          const i1 = idxAcc ? idxAcc.getScalar(tIdx * 3 + 1) : tIdx * 3 + 1;
          const i2 = idxAcc ? idxAcc.getScalar(tIdx * 3 + 2) : tIdx * 3 + 2;
          if (i0 === i1 || i1 === i2 || i0 === i2) continue;
          const o = validTris * 9;
          posAcc.getElement(i0, v);
          raw[o] = v[0];
          raw[o + 1] = v[1];
          raw[o + 2] = v[2];
          posAcc.getElement(i1, v);
          raw[o + 3] = v[0];
          raw[o + 4] = v[1];
          raw[o + 5] = v[2];
          posAcc.getElement(i2, v);
          raw[o + 6] = v[0];
          raw[o + 7] = v[1];
          raw[o + 8] = v[2];
          validTris++;
        }
        if (validTris === 0) continue;
        const matName = prim.getMaterial()?.getName() ?? "";
        const built = buildBvh(raw.subarray(0, validTris * 9), validTris);
        primitives.push({
          materialName: matName,
          semantic: normalizeSemanticMaterial(matName),
          tris: built.tris,
          triCount: validTris,
          bvh: built.bvh,
        });
      }
    }

    const idx = nodes.length;
    const name = gltfNode.getName() || "";
    nodes.push({
      name,
      parent,
      localPos: [t[0], t[1], t[2]],
      localQuat: [r[0], r[1], r[2], r[3]],
      localScale: [s[0], s[1], s[2]],
      primitives,
    });
    if (name && !byName.has(name)) byName.set(name, idx);
    for (const child of gltfNode.listChildren()) visit(child, idx);
  };

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (scene) {
    for (const child of scene.listChildren()) visit(child, -1);
  }
  return { nodes, byName };
}

export async function loadParsedGlb(filePath: string): Promise<ParsedGlb> {
  const hit = glbCache.get(filePath);
  if (hit) return hit;
  const io = await getNodeIO();
  const doc = await io.read(filePath);
  const parsed = parseDocument(doc);
  glbCache.set(filePath, parsed);
  return parsed;
}

/** Squared distance from point P to triangle ABC (Ericson, Real-Time Collision Detection). */
function pointTriangleDistSq(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;

  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    const dx = px - (ax + v * abx);
    const dy = py - (ay + v * aby);
    const dz = pz - (az + v * abz);
    return dx * dx + dy * dy + dz * dz;
  }

  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    const dx = px - (ax + w * acx);
    const dy = py - (ay + w * acy);
    const dz = pz - (az + w * acz);
    return dx * dx + dy * dy + dz * dz;
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const dx = px - (bx + w * (cx - bx));
    const dy = py - (by + w * (cy - by));
    const dz = pz - (bz + w * (cz - bz));
    return dx * dx + dy * dy + dz * dz;
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  const dx = px - (ax + abx * v + acx * w);
  const dy = py - (ay + aby * v + acy * w);
  const dz = pz - (az + abz * v + acz * w);
  return dx * dx + dy * dy + dz * dz;
}

function pointAabbDistSq(px: number, py: number, pz: number, n: BvhNode): number {
  const dx = px < n.minX ? n.minX - px : px > n.maxX ? px - n.maxX : 0;
  const dy = py < n.minY ? n.minY - py : py > n.maxY ? py - n.maxY : 0;
  const dz = pz < n.minZ ? n.minZ - pz : pz > n.maxZ ? pz - n.maxZ : 0;
  return dx * dx + dy * dy + dz * dz;
}

function bvhPointDistSq(prim: PrimitiveMesh, px: number, py: number, pz: number, maxDistSq: number): number {
  const { bvh, tris } = prim;
  if (bvh.length === 0) return Infinity;
  let best = maxDistSq;
  const stack: number[] = [0];
  while (stack.length > 0) {
    const node = bvh[stack.pop()!];
    if (pointAabbDistSq(px, py, pz, node) >= best) continue;
    if (node.count > 0) {
      const end = node.start + node.count;
      for (let i = node.start; i < end; i++) {
        const o = i * 9;
        const d2 = pointTriangleDistSq(
          px,
          py,
          pz,
          tris[o],
          tris[o + 1],
          tris[o + 2],
          tris[o + 3],
          tris[o + 4],
          tris[o + 5],
          tris[o + 6],
          tris[o + 7],
          tris[o + 8],
        );
        if (d2 < best) best = d2;
      }
    } else {
      const l = bvh[node.left];
      const r = bvh[node.right];
      const dl = pointAabbDistSq(px, py, pz, l);
      const dr = pointAabbDistSq(px, py, pz, r);
      if (dl < dr) {
        if (dr < best) stack.push(node.right);
        if (dl < best) stack.push(node.left);
      } else {
        if (dl < best) stack.push(node.left);
        if (dr < best) stack.push(node.right);
      }
    }
  }
  return best;
}

interface PlacedPrimitive {
  ownerId: string;
  nodeName: string;
  prim: PrimitiveMesh;
  world: Matrix4;
  invWorld: Matrix4;
  /** Maximum axis scale magnitude, used to convert local distances accurately into world meters. */
  minScale: number;
  maxScale: number;
  worldMin: Vector3;
  worldMax: Vector3;
}

const tmpV = new Vector3();
const tmpQ = new Quaternion();
const tmpS = new Vector3();
const tmpE = new Euler(0, 0, 0, "XYZ");
const tmpM = new Matrix4();
const tmpLocalPt = new Vector3();

function computeNodeWorlds(
  parsed: ParsedGlb,
  rootMatrix: Matrix4,
  overrides?: GlbNodePose[],
): Matrix4[] {
  const overrideMap = overrides?.length ? new Map(overrides.map((o) => [o.node, o])) : null;
  const worlds: Matrix4[] = Array.from({ length: parsed.nodes.length });

  for (let i = 0; i < parsed.nodes.length; i++) {
    const node = parsed.nodes[i];
    const ov = overrideMap && node.name ? overrideMap.get(node.name) : undefined;
    tmpV.set(...node.localPos);
    tmpQ.set(...node.localQuat);
    tmpS.set(...node.localScale);

    if (ov) {
      if (ov.pos) tmpV.set(...ov.pos);
      else if (ov.posOffset) {
        tmpV.x += ov.posOffset[0];
        tmpV.y += ov.posOffset[1];
        tmpV.z += ov.posOffset[2];
      }
      if (ov.quat) tmpQ.set(...ov.quat);
      else if (ov.rotOffset) {
        tmpQ.multiply(new Quaternion().setFromEuler(tmpE.set(...ov.rotOffset)));
      }
    }

    tmpM.compose(tmpV, tmpQ, tmpS);
    const world = new Matrix4();
    if (node.parent < 0) world.multiplyMatrices(rootMatrix, tmpM);
    else world.multiplyMatrices(worlds[node.parent], tmpM);
    worlds[i] = world;
  }
  return worlds;
}

function collectPlacedPrimitives(
  ownerId: string,
  parsed: ParsedGlb,
  worlds: Matrix4[],
): PlacedPrimitive[] {
  const out: PlacedPrimitive[] = [];
  const corner = new Vector3();
  for (let i = 0; i < parsed.nodes.length; i++) {
    const node = parsed.nodes[i];
    if (node.primitives.length === 0) continue;
    const world = worlds[i];
    const det = world.determinant();
    if (Math.abs(det) < 1e-12) continue;
    const invWorld = world.clone().invert();

    const e = world.elements;
    const sx = Math.hypot(e[0], e[1], e[2]);
    const sy = Math.hypot(e[4], e[5], e[6]);
    const sz = Math.hypot(e[8], e[9], e[10]);
    const minScale = Math.min(sx, sy, sz);
    const maxScale = Math.max(sx, sy, sz);
    if (minScale < 1e-6) continue;

    for (const prim of node.primitives) {
      if (prim.bvh.length === 0) continue;
      const root = prim.bvh[0];
      const worldMin = new Vector3(Infinity, Infinity, Infinity);
      const worldMax = new Vector3(-Infinity, -Infinity, -Infinity);
      for (let mask = 0; mask < 8; mask++) {
        corner
          .set(
            mask & 1 ? root.maxX : root.minX,
            mask & 2 ? root.maxY : root.minY,
            mask & 4 ? root.maxZ : root.minZ,
          )
          .applyMatrix4(world);
        worldMin.min(corner);
        worldMax.max(corner);
      }
      out.push({
        ownerId,
        nodeName: node.name,
        prim,
        world,
        invWorld,
        minScale,
        maxScale,
        worldMin,
        worldMax,
      });
    }
  }
  return out;
}

/** Exact world distance from point `p` to a placed primitive, bounded above by `cutoff`. */
function worldPointDistToPlaced(placed: PlacedPrimitive, p: Vector3, cutoff: number): number {
  const dx = p.x < placed.worldMin.x ? placed.worldMin.x - p.x : p.x > placed.worldMax.x ? p.x - placed.worldMax.x : 0;
  const dy = p.y < placed.worldMin.y ? placed.worldMin.y - p.y : p.y > placed.worldMax.y ? p.y - placed.worldMax.y : 0;
  const dz = p.z < placed.worldMin.z ? placed.worldMin.z - p.z : p.z > placed.worldMax.z ? p.z - placed.worldMax.z : 0;
  if (dx * dx + dy * dy + dz * dz >= cutoff * cutoff) return Infinity;

  tmpLocalPt.copy(p).applyMatrix4(placed.invWorld);
  // Conservative local cutoff accounts for non-uniform scale (e.g. quantized glTF nodes).
  const localCutoff = cutoff / placed.minScale;
  const localDistSq = bvhPointDistSq(
    placed.prim,
    tmpLocalPt.x,
    tmpLocalPt.y,
    tmpLocalPt.z,
    localCutoff * localCutoff,
  );
  if (!Number.isFinite(localDistSq) || localDistSq >= localCutoff * localCutoff) return Infinity;
  // Re-evaluate exact world distance using uniform-scale bound; for exact non-uniform scaling,
  // `minScale * sqrt(localDistSq)` is a tight lower bound (conservative for collision detection).
  return Math.sqrt(localDistSq) * placed.minScale;
}

function defaultGlbAllowance(
  semantic: string | null,
  colliderId: string,
  contactAs: string | undefined,
  sequence: Sequence,
  ownerId: string,
): number {
  const ownerBase = ownerId.replace(/^machines\//, "");
  let maxContact = 0;
  for (const [prefix, allowed] of Object.entries(sequence.contacts)) {
    const val = allowed[colliderId] ?? (contactAs ? allowed[contactAs] : undefined);
    if (val === undefined) continue;
    if (
      ownerId === prefix ||
      ownerId.startsWith(prefix) ||
      prefix === ownerBase ||
      prefix.startsWith(`${ownerBase}.`) ||
      ownerBase.startsWith(prefix) ||
      semantic === "mat_pad" ||
      semantic === "mat_grip"
    ) {
      maxContact = Math.max(maxContact, val);
    }
  }
  if (semantic === "mat_pad") {
    return Math.max(maxContact, 0.048);
  }
  if (semantic === "mat_grip") {
    if (colliderId.startsWith("hand_")) return Math.max(maxContact, 0.055);
    if (colliderId.startsWith("forearm_")) return Math.max(maxContact, 0.025);
    if (colliderId.startsWith("foot_") || colliderId.startsWith("toes_")) return Math.max(maxContact, 0.045);
  }
  if ((semantic === "mat_rubber" || semantic === "mat_wood") && (colliderId.startsWith("foot_") || colliderId.startsWith("toes_"))) {
    return Math.max(maxContact, 0.03);
  }
  if (semantic === "mat_chrome" && colliderId.startsWith("hand_")) {
    return Math.max(maxContact, 0.045);
  }
  return maxContact;
}

export interface GlbValidationOptions {
  /** Extra directories to search for `<id>.glb` files before the repo defaults. */
  modelDirs?: string[];
  /** Frame stride for dense sequences (default 3; key frames 0, mid, peak are always checked). */
  frameStride?: number;
}

/**
 * Validates a baked `Sequence` directly against its ACTUAL loaded 3D GLB meshes (static machines,
 * animated GLB nodes, and moving GLB props). Catches bugs invisible to parametric-box QA:
 * - missing GLB files
 * - body capsules clipping into actual GLB frame/shroud/footrest steel meshes
 * - cables/tethers slicing through solid GLB frame columns or weight shrouds
 * - required contact anchors floating far away from any GLB surface (e.g. backwards/offset machine)
 */
export async function validateGlbMotion(
  body: Body,
  sequence: Sequence,
  kin: Kinematics,
  options: GlbValidationOptions = {},
): Promise<Issue[]> {
  const glbRefs: GlbRef[] = sequence.glb ?? [];
  const glbPropIndices = sequence.props
    .map((p, idx) => (p.kind === "glb" ? idx : -1))
    .filter((idx) => idx >= 0);

  if (glbRefs.length === 0 && glbPropIndices.length === 0) return [];

  const issues: Issue[] = [];
  const extraDirs = options.modelDirs ?? [];

  const loadedStatic: { ref: GlbRef; parsed: ParsedGlb }[] = [];
  for (const ref of glbRefs) {
    const path = resolveGlbPath(ref.id, extraDirs);
    if (!path) {
      issues.push({
        code: "glb-clip",
        severity: "error",
        title: `Missing GLB model "${ref.id}"`,
        detail: `Could not locate ${ref.id}.glb under exercise-motion/models or dist/gym/models`,
        frames: [[0, sequence.poses.length - 1]],
      });
      continue;
    }
    loadedStatic.push({ ref, parsed: await loadParsedGlb(path) });
  }

  const loadedProps: { propIdx: number; id: string; parsed: ParsedGlb }[] = [];
  for (const propIdx of glbPropIndices) {
    const prop = sequence.props[propIdx];
    if (prop.kind !== "glb") continue;
    const path = resolveGlbPath(prop.glbId, extraDirs);
    if (!path) {
      issues.push({
        code: "glb-clip",
        severity: "error",
        title: `Missing prop GLB "${prop.glbId}"`,
        detail: `Could not locate ${prop.glbId}.glb for prop "${prop.id}"`,
        frames: [[0, sequence.poses.length - 1]],
      });
      continue;
    }
    loadedProps.push({ propIdx, id: prop.id, parsed: await loadParsedGlb(path) });
  }

  const count = sequence.poses.length;
  if (count === 0) return issues;
  const stride = Math.max(1, options.frameStride ?? 3);
  const clampFrame = (idx: number) => Math.min(count - 1, Math.max(0, idx));
  const peak = clampFrame(sequence.phases[1]?.from ?? Math.floor(count / 2));
  const mid = clampFrame(Math.floor(peak / 2));
  const frameSet = new Set<number>([0, mid, peak, count - 1]);
  for (let f = 0; f < count; f += stride) frameSet.add(f);
  const sampleFrames = [...frameSet].sort((a, b) => a - b);

  // Precompute static GLB placements when there are no per-frame glbStates.
  const hasGlbStates = Boolean(sequence.glbStates?.length);
  const staticRootMat = (ref: GlbRef) =>
    new Matrix4().compose(
      new Vector3(...ref.pos),
      ref.quat ? new Quaternion(...ref.quat) : new Quaternion(),
      new Vector3(ref.scale ?? 1, ref.scale ?? 1, ref.scale ?? 1),
    );
  const cachedStaticPlaced: PlacedPrimitive[] | null = hasGlbStates
    ? null
    : loadedStatic.flatMap(({ ref, parsed }) =>
        collectPlacedPrimitives(ref.id, parsed, computeNodeWorlds(parsed, staticRootMat(ref))),
      );

  const visible = body.colliders
    .map((c, i) => (c.visible ? i : -1))
    .filter((i) => i >= 0);
  const capsules = newCapsules(body);
  const samplePt = new Vector3();

  const clipWorst = new Map<string, { depth: number; frames: number[]; detail: string; title: string }>();
  const contactMismatchWorst = new Map<string, { gap: number; frames: number[]; label: string }>();
  const cableClipWorst = new Map<string, { frames: number[]; label: string }>();

  const recordClip = (key: string, f: number, depth: number, title: string, detail: string) => {
    const cur = clipWorst.get(key);
    if (!cur) clipWorst.set(key, { depth, frames: [f], title, detail });
    else {
      cur.frames.push(f);
      if (depth > cur.depth) {
        cur.depth = depth;
        cur.detail = detail;
      }
    }
  };

  const hideStaticEquipment = glbRefs.some((r) => r.hideEquipment);
  const CAPSULE_SAMPLES = 5;

  for (const f of sampleFrames) {
    const frame = kin.frames[f];
    capsulesInWorld(body, frame, capsules);

    const frameStaticPlaced =
      cachedStaticPlaced ??
      loadedStatic.flatMap(({ ref, parsed }, gIdx) =>
        collectPlacedPrimitives(
          ref.id,
          parsed,
          computeNodeWorlds(parsed, staticRootMat(ref), sequence.glbStates?.[f]?.[gIdx]),
        ),
      );

    const framePropPlaced = loadedProps.flatMap(({ propIdx, id, parsed }) => {
      const prop = sequence.props[propIdx];
      const st = sequence.propStates[f][propIdx];
      const propMat = new Matrix4().compose(
        new Vector3(...st.pos),
        new Quaternion(...st.quat),
        new Vector3(1, 1, 1),
      );
      if (prop.kind === "glb") {
        const localMat = new Matrix4().compose(
          prop.offset ? new Vector3(...prop.offset) : new Vector3(),
          prop.quat ? new Quaternion(...prop.quat) : new Quaternion(),
          new Vector3(prop.scale ?? 1, prop.scale ?? 1, prop.scale ?? 1),
        );
        propMat.multiply(localMat);
      }
      return collectPlacedPrimitives(id, parsed, computeNodeWorlds(parsed, propMat));
    });

    const allPlaced = [...frameStaticPlaced, ...framePropPlaced];

    // 1. Body capsule vs actual GLB mesh penetration.
    for (const i of visible) {
      const col = body.colliders[i];
      const a = capsules.a[i];
      const b = capsules.b[i];
      for (let s = 0; s < CAPSULE_SAMPLES; s++) {
        const t = s / (CAPSULE_SAMPLES - 1);
        samplePt.lerpVectors(a, b, t);
        const radius = col.ra + (col.rb - col.ra) * t;
        for (const placed of allPlaced) {
          const allow = defaultGlbAllowance(placed.prim.semantic, col.id, col.contactAs, sequence, placed.ownerId);
          // Skip pads where resting is expected unless deep penetration occurs.
          const cutoff = radius - allow;
          if (cutoff <= 0.015) continue;
          const dist = worldPointDistToPlaced(placed, samplePt, cutoff);
          if (!Number.isFinite(dist)) continue;
          const depth = cutoff - dist;
          if (depth > 0.015) {
            const target = placed.prim.semantic ?? placed.nodeName ?? placed.ownerId;
            recordClip(
              `glb:${col.id}:${placed.ownerId}:${target}`,
              f,
              depth,
              `${col.id} clips GLB ${placed.ownerId} (${target})`,
              `${(depth * 100).toFixed(1)} cm into actual 3D GLB geometry`,
            );
          }
        }
      }
    }

    // 2. Cable/tether vs hard GLB frame/shroud clipping.
    const tethers = sequence.tetherStates?.[f];
    if (tethers?.length) {
      const segPt = new Vector3();
      for (let tIdx = 0; tIdx < tethers.length; tIdx++) {
        const pts = tethers[tIdx].points;
        const tetherId = sequence.tethers?.[tIdx]?.id ?? `cable_${tIdx}`;
        for (let seg = 0; seg + 1 < pts.length; seg++) {
          const p0 = new Vector3(...pts[seg]);
          const p1 = new Vector3(...pts[seg + 1]);
          const len = p0.distanceTo(p1);
          if (len < 0.22) continue;
          // Check interior of cable segment (skipping 9 cm at pulley exit & handle ring).
          const u0 = 0.09 / len;
          const u1 = 1 - 0.09 / len;
          const steps = Math.max(4, Math.min(12, Math.ceil((len - 0.18) / 0.12)));
          for (let k = 0; k <= steps; k++) {
            const u = u0 + ((u1 - u0) * k) / steps;
            segPt.lerpVectors(p0, p1, u);
            for (const placed of frameStaticPlaced) {
              const sem = placed.prim.semantic;
              if (sem === "mat_cable" || sem === "mat_grip") continue;
              const dist = worldPointDistToPlaced(placed, segPt, 0.006);
              if (dist < 0.006) {
                const key = `cable-glb:${tetherId}:${placed.ownerId}`;
                const cur = cableClipWorst.get(key);
                if (!cur) cableClipWorst.set(key, { frames: [f], label: `${tetherId} passes through GLB ${placed.ownerId}` });
                else cur.frames.push(f);
                break;
              }
            }
          }
        }
      }
    }

    // 3. Required contact grounding against actual GLB surfaces (catches backwards/offset GLBs).
    if (hideStaticEquipment || framePropPlaced.length > 0) {
      for (const req of sequence.required) {
        if (req.surfaceY !== undefined) continue;
        let candidates: PlacedPrimitive[] = [];
        if (req.part && hideStaticEquipment) {
          candidates = frameStaticPlaced;
        } else if (req.prop) {
          const matchingProp = framePropPlaced.filter((p) => p.ownerId === req.prop);
          if (matchingProp.length > 0) {
            candidates = matchingProp;
          } else if (
            hideStaticEquipment &&
            sequence.props.some((p) => p.id === req.prop && p.kind === "parts" && p.hidden)
          ) {
            candidates = frameStaticPlaced;
          } else {
            continue;
          }
        }
        if (candidates.length === 0) continue;

        const pt = anchorPoint(body, frame, req.anchor);
        let nearest = Infinity;
        for (const placed of candidates) {
          const d = worldPointDistToPlaced(placed, pt, Math.min(nearest, 0.25));
          if (d < nearest) nearest = d;
        }
        if (nearest > 0.065) {
          const cur = contactMismatchWorst.get(req.label);
          if (!cur) contactMismatchWorst.set(req.label, { gap: nearest, frames: [f], label: req.label });
          else {
            cur.frames.push(f);
            if (nearest > cur.gap) cur.gap = nearest;
          }
        }
      }
    }
  }

  const toSpans = (frames: number[]): [number, number][] => {
    const sorted = [...new Set(frames)].sort((a, b) => a - b);
    return sorted.map((n) => [n, n]);
  };

  for (const entry of clipWorst.values()) {
    issues.push({
      code: "glb-clip",
      severity: entry.depth > 0.03 ? "error" : "warning",
      title: entry.title,
      detail: entry.detail,
      frames: toSpans(entry.frames),
    });
  }
  for (const entry of cableClipWorst.values()) {
    issues.push({
      code: "cable-clip",
      severity: "error",
      title: entry.label,
      detail: "Cable interior intersects solid GLB machine geometry",
      frames: toSpans(entry.frames),
    });
  }
  for (const entry of contactMismatchWorst.values()) {
    issues.push({
      code: "contact-lost",
      severity: "error",
      title: `${entry.label}: GLB contact mismatch`,
      detail: Number.isFinite(entry.gap)
        ? `Anchor sits ${(entry.gap * 100).toFixed(1)} cm away from actual GLB mesh surface (misaligned or flipped GLB)`
        : "Anchor sits >25 cm away from any surface on the GLB mesh (misaligned or flipped GLB)",
      frames: toSpans(entry.frames),
    });
  }

  return issues;
}
