import type { Side } from "../src/body";

export interface FingerBone {
  name: string;
  /** The joint this bone hangs from: `wrist_L` or the previous bone of the same finger. */
  parent: string;
  /** 1 is the thumb, 5 the little finger; segment 1 is nearest the palm. */
  finger: number;
  segment: number;
  side: Side;
  /**
   * Rest frame in the bind pose: the bone along local +Y, local +X its flexion axis, local +Z the way its pad faces.
   * The fingers' pads face out of the palm; the thumb's face across it, toward the index finger.
   */
  position: [number, number, number];
  rotation: [number, number, number, number];
  /** Metres from this bone's joint to the next one, or to the end of the bone for the last segment. */
  length: number;
  /** Metres from this bone's joint to the farthest skin along it: the fingertip, on the last segment. */
  tip: number;
  /** How far the skin of the pad, and of the back, sits from the bone's centre line, in metres. */
  pad: number;
  back: number;
}

/** The lifter's mesh in its bind pose, skinned to the rig's joints followed by the finger bones. */
export interface LifterAsset {
  source: string;
  /** World frame of each rig joint in the bind pose, in `createBody` order. */
  bind: { position: [number, number, number]; rotation: [number, number, number, number] }[];
  fingers: FingerBone[];
  positions: Float32Array;
  /** Smooth normals in the bind pose, shared across texture seams. */
  normals: Float32Array;
  /** Each vertex's optimized centre of rotation in the bind pose. */
  centers: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
  /** Four joint indices and four weights out of 255 per vertex. */
  skinIndex: Uint8Array;
  skinWeight: Uint8Array;
}

const ARRAYS = ["positions", "normals", "centers", "uvs", "indices", "skinIndex", "skinWeight"] as const;
type ArrayName = (typeof ARRAYS)[number];
const TYPES = {
  positions: Float32Array,
  normals: Float32Array,
  centers: Float32Array,
  uvs: Float32Array, indices: Uint16Array, skinIndex: Uint8Array, skinWeight: Uint8Array };

export function encodeLifter(asset: LifterAsset): Uint8Array {
  const sections: Record<string, [number, number]> = {};
  const chunks: Uint8Array[] = [];
  let offset = 0;
  for (const name of ARRAYS) {
    const bytes = new Uint8Array(asset[name].buffer, asset[name].byteOffset, asset[name].byteLength);
    sections[name] = [offset, asset[name].length];
    chunks.push(bytes);
    offset += bytes.byteLength;
    const pad = (4 - (offset % 4)) % 4;
    chunks.push(new Uint8Array(pad));
    offset += pad;
  }
  const header = new TextEncoder().encode(
    JSON.stringify({ source: asset.source, bind: asset.bind, fingers: asset.fingers, sections }),
  );
  const headerLength = header.byteLength + ((4 - (header.byteLength % 4)) % 4);
  const out = new Uint8Array(4 + headerLength + offset);
  new DataView(out.buffer).setUint32(0, headerLength, true);
  out.set(header, 4);
  let at = 4 + headerLength;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

export function decodeLifter(buffer: ArrayBuffer): LifterAsset {
  const headerLength = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)).replace(/\0+$/, ""));
  const base = 4 + headerLength;
  const arrays = {} as Record<ArrayName, ArrayLike<number>>;
  for (const name of ARRAYS) {
    const [offset, length] = header.sections[name];
    arrays[name] = new TYPES[name](buffer, base + offset, length);
  }
  return { source: header.source, bind: header.bind, fingers: header.fingers, ...arrays } as LifterAsset;
}
