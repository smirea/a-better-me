/** A quad mesh with shared vertices and a texture coordinate per quad corner. */
export interface QuadMesh {
  positions: Float64Array;
  /** Skin weights per vertex: joint index to weight. */
  weights: Map<number, number>[];
  quads: Uint32Array;
  /** Two texture coordinates per quad corner. */
  uvs: Float64Array;
  /** A value per vertex, interpolated like the skin weights. */
  mark: Float64Array;
}

const mix = (maps: Map<number, number>[]) => {
  const out = new Map<number, number>();
  for (const map of maps) for (const [joint, w] of map) out.set(joint, (out.get(joint) ?? 0) + w / maps.length);
  return out;
};

/**
 * One level of Catmull-Clark subdivision. Positions follow the smoothing rules, with open edges (the eyes, the
 * mouth) kept as creases; skin weights and texture coordinates interpolate linearly so they stay where they were.
 */
export function subdivide(mesh: QuadMesh): QuadMesh {
  const vertexCount = mesh.positions.length / 3;
  const faceCount = mesh.quads.length / 4;
  const p = (v: number, a: number) => mesh.positions[v * 3 + a];

  const edges = new Map<string, { a: number; b: number; faces: number[]; index: number }>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const faceEdges: string[][] = [];
  for (let f = 0; f < faceCount; f++) {
    const keys: string[] = [];
    for (let k = 0; k < 4; k++) {
      const a = mesh.quads[f * 4 + k];
      const b = mesh.quads[f * 4 + ((k + 1) % 4)];
      const key = edgeKey(a, b);
      const edge = edges.get(key) ?? { a, b, faces: [], index: 0 };
      edge.faces.push(f);
      edges.set(key, edge);
      keys.push(key);
    }
    faceEdges.push(keys);
  }

  const facePoint = new Float64Array(faceCount * 3);
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 4; k++) for (let a = 0; a < 3; a++) facePoint[f * 3 + a] += p(mesh.quads[f * 4 + k], a) / 4;
  }

  const total = vertexCount + edges.size + faceCount;
  const positions = new Float64Array(total * 3);
  const weights: Map<number, number>[] = Array.from({ length: total });
  const mark = new Float64Array(total);
  let next = vertexCount;
  const edgeSum = new Float64Array(vertexCount * 3);
  const faceSum = new Float64Array(vertexCount * 3);
  const valence = new Uint32Array(vertexCount);
  const faces = new Uint32Array(vertexCount);
  const boundarySum = new Float64Array(vertexCount * 3);
  const boundaryCount = new Uint32Array(vertexCount);
  for (const edge of edges.values()) {
    edge.index = next++;
    const open = edge.faces.length < 2;
    for (let a = 0; a < 3; a++) {
      const mid = (p(edge.a, a) + p(edge.b, a)) / 2;
      positions[edge.index * 3 + a] = open
        ? mid
        : (p(edge.a, a) + p(edge.b, a) + facePoint[edge.faces[0] * 3 + a] + facePoint[edge.faces[1] * 3 + a]) / 4;
      for (const v of [edge.a, edge.b]) {
        edgeSum[v * 3 + a] += mid;
        if (open) boundarySum[v * 3 + a] += p(v === edge.a ? edge.b : edge.a, a);
      }
    }
    valence[edge.a]++;
    valence[edge.b]++;
    if (open) {
      boundaryCount[edge.a]++;
      boundaryCount[edge.b]++;
    }
    weights[edge.index] = mix([mesh.weights[edge.a], mesh.weights[edge.b]]);
    mark[edge.index] = (mesh.mark[edge.a] + mesh.mark[edge.b]) / 2;
  }
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 4; k++) {
      const v = mesh.quads[f * 4 + k];
      faces[v]++;
      for (let a = 0; a < 3; a++) faceSum[v * 3 + a] += facePoint[f * 3 + a];
    }
  }
  for (let v = 0; v < vertexCount; v++) {
    weights[v] = mesh.weights[v];
    mark[v] = mesh.mark[v];
    const n = valence[v];
    for (let a = 0; a < 3; a++) {
      positions[v * 3 + a] =
        boundaryCount[v] >= 2
          ? (6 * p(v, a) + boundarySum[v * 3 + a]) / 8
          : n === 0
            ? p(v, a)
            : (faceSum[v * 3 + a] / faces[v] + (2 * edgeSum[v * 3 + a]) / n + (n - 3) * p(v, a)) / n;
    }
  }
  const faceBase = next;
  for (let f = 0; f < faceCount; f++) {
    positions.set(facePoint.subarray(f * 3, f * 3 + 3), (faceBase + f) * 3);
    weights[faceBase + f] = mix([0, 1, 2, 3].map((k) => mesh.weights[mesh.quads[f * 4 + k]]));
    mark[faceBase + f] = [0, 1, 2, 3].reduce((sum, k) => sum + mesh.mark[mesh.quads[f * 4 + k]], 0) / 4;
  }

  const quads = new Uint32Array(faceCount * 16);
  const uvs = new Float64Array(faceCount * 32);
  for (let f = 0; f < faceCount; f++) {
    const corner = (k: number) => [mesh.uvs[(f * 4 + k) * 2], mesh.uvs[(f * 4 + k) * 2 + 1]];
    const uvMid = (...ks: number[]) => [0, 1].map((a) => ks.reduce((sum, k) => sum + corner(k)[a], 0) / ks.length);
    const center = faceBase + f;
    const centerUv = uvMid(0, 1, 2, 3);
    for (let k = 0; k < 4; k++) {
      const previous = (k + 3) % 4;
      const out = f * 4 + k;
      quads.set(
        [mesh.quads[f * 4 + k], edges.get(faceEdges[f][k])!.index, center, edges.get(faceEdges[f][previous])!.index],
        out * 4,
      );
      uvs.set([...corner(k), ...uvMid(k, (k + 1) % 4), ...centerUv, ...uvMid(previous, k)], out * 8);
    }
  }
  return { positions, weights, quads, uvs, mark };
}
