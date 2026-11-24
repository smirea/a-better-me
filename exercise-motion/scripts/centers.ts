import type { QuadMesh } from "./subdivide";

/**
 * Each vertex's optimized centre of rotation (Le and Hodgins, "Real-time Skeletal Skinning with Optimized Centers of
 * Rotation", 2016): the area-weighted mean of the triangles skinned like it. Rotating a vertex about this point
 * instead of blending its joints' transforms keeps a bent joint from collapsing, as linear blending does, or from
 * bulging, as dual quaternions do. A vertex that follows one joint keeps its own position, which it doesn't use.
 */
export function rotationCenters(mesh: QuadMesh): Float64Array {
  const sigma2 = 0.1 * 0.1;
  const vertexCount = mesh.positions.length / 3;
  const triangles: { weights: Map<number, number>; area: number; center: [number, number, number] }[] = [];
  const byPair = new Map<string, number[]>();
  const pairKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const p = (v: number, a: number) => mesh.positions[v * 3 + a];

  for (let q = 0; q < mesh.quads.length / 4; q++) {
    for (const [a, b, c] of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      const [i, j, k] = [a, b, c].map((n) => mesh.quads[q * 4 + n]);
      const e1 = [0, 1, 2].map((d) => p(j, d) - p(i, d));
      const e2 = [0, 1, 2].map((d) => p(k, d) - p(i, d));
      const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const area = Math.hypot(...cross) / 2;
      const weights = new Map<number, number>();
      for (const v of [i, j, k]) for (const [joint, w] of mesh.weights[v]) weights.set(joint, (weights.get(joint) ?? 0) + w / 3);
      const index = triangles.length;
      triangles.push({
        weights,
        area,
        center: [0, 1, 2].map((d) => (p(i, d) + p(j, d) + p(k, d)) / 3) as [number, number, number],
      });
      const joints = [...weights.keys()];
      for (let x = 0; x < joints.length; x++) {
        for (let y = x + 1; y < joints.length; y++) {
          const key = pairKey(joints[x], joints[y]);
          const list = byPair.get(key) ?? [];
          list.push(index);
          byPair.set(key, list);
        }
      }
    }
  }

  const centers = new Float64Array(mesh.positions);
  for (let v = 0; v < vertexCount; v++) {
    const own = [...mesh.weights[v]];
    if (own.length < 2) continue;
    let total = 0;
    const sum = [0, 0, 0];
    for (let x = 0; x < own.length; x++) {
      for (let y = x + 1; y < own.length; y++) {
        const [j, wj] = own[x];
        const [k, wk] = own[y];
        for (const t of byPair.get(pairKey(j, k)) ?? []) {
          const triangle = triangles[t];
          const tj = triangle.weights.get(j)!;
          const tk = triangle.weights.get(k)!;
          const difference = wj * tk - wk * tj;
          // The sum over ordered pairs counts each unordered pair twice.
          const similarity = 2 * wj * wk * tj * tk * Math.exp(-(difference * difference) / sigma2);
          const weight = similarity * triangle.area;
          total += weight;
          for (let d = 0; d < 3; d++) sum[d] += weight * triangle.center[d];
        }
      }
    }
    if (total > 1e-12) for (let d = 0; d < 3; d++) centers[v * 3 + d] = sum[d] / total;
  }
  return centers;
}
