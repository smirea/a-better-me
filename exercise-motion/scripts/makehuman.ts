import { join } from "node:path";

/** MakeHuman's repository at the commit the lifter was built from. Its assets are CC0. */
export const MAKEHUMAN_COMMIT = "a8bc2d54ff0ac92e78ff71431b1023eda42bf482";
const CACHE = join(import.meta.dir, "../.cache/makehuman");

async function fetchAsset(path: string) {
  const local = Bun.file(join(CACHE, path));
  if (await local.exists()) return local.text();
  const url = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${MAKEHUMAN_COMMIT}/makehuman/data/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const text = await response.text();
  await Bun.write(local, text);
  return text;
}

export interface Mesh {
  /** Every vertex of the base mesh, the joint helpers included, in metres. */
  positions: Float64Array;
  /** The body's quads, as vertex indices. */
  quads: Uint32Array;
  /** The texture coordinate index of each quad corner, into `texcoords`. */
  corners: Uint32Array;
  texcoords: Float32Array;
}

export async function loadBaseMesh(): Promise<Mesh> {
  const text = await fetchAsset("3dobjs/base.obj");
  const positions: number[] = [];
  const texcoords: number[] = [];
  const quads: number[] = [];
  const corners: number[] = [];
  let group = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      positions.push(Number(x), Number(y), Number(z));
    } else if (line.startsWith("vt ")) {
      const [, u, v] = line.split(/\s+/);
      texcoords.push(Number(u), Number(v));
    } else if (line.startsWith("g ")) {
      group = line.slice(2).trim();
    } else if (line.startsWith("f ") && group === "body") {
      const face = line.trim().split(/\s+/).slice(1);
      if (face.length !== 4) throw new Error(`The body has a face with ${face.length} corners`);
      for (const corner of face) {
        const [v, t] = corner.split("/").map(Number);
        quads.push(v - 1);
        corners.push(t - 1);
      }
    }
  }
  return {
    positions: Float64Array.from(positions),
    quads: Uint32Array.from(quads),
    corners: Uint32Array.from(corners),
    texcoords: Float32Array.from(texcoords),
  };
}

/** Adds a target's offsets, scaled by `weight`, to positions still in MakeHuman's decimetres. */
export async function applyTarget(positions: Float64Array, path: string, weight: number) {
  if (weight === 0) return;
  for (const line of (await fetchAsset(path)).split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [index, dx, dy, dz] = line.split(/\s+/).map(Number);
    positions[index * 3] += dx * weight;
    positions[index * 3 + 1] += dy * weight;
    positions[index * 3 + 2] += dz * weight;
  }
}

export interface Skeleton {
  bones: Record<string, { head: string; tail: string; parent: string | null }>;
  joints: Record<string, number[]>;
  weights: Record<string, [number, number][]>;
}

export async function loadSkeleton(): Promise<Skeleton> {
  const rig = JSON.parse(await fetchAsset("rigs/default.mhskel"));
  const weights = JSON.parse(await fetchAsset("rigs/default_weights.mhw"));
  return { bones: rig.bones, joints: rig.joints, weights: weights.weights };
}

/** A joint's position is the centre of the helper vertices MakeHuman places it at. */
export function jointPosition(skeleton: Skeleton, positions: Float64Array, name: string): [number, number, number] {
  const vertices = skeleton.joints[name];
  if (!vertices) throw new Error(`MakeHuman has no joint ${name}`);
  const sum = [0, 0, 0];
  for (const v of vertices) for (let a = 0; a < 3; a++) sum[a] += positions[v * 3 + a];
  return [sum[0] / vertices.length, sum[1] / vertices.length, sum[2] / vertices.length];
}
