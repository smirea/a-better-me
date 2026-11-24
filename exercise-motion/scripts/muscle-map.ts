import { deflateSync } from "node:zlib";
import { join } from "node:path";
import { MUSCLES } from "../src/muscles";

/**
 * The app's flat body map (`app-ios/Sources/CoreResources/Catalog/body.json`), rasterised: front view at x 0 to 907,
 * back view at x 1000 to 1907, 1876 pixels from the top of the head to the soles.
 */
export interface BodyMap {
  width: number;
  height: number;
  /** -1 outside the body, 0 on the body between plates, `MUSCLES` index + 1 on a plate. */
  labels: Int16Array;
  /** 1 at the surface, falling to 0 in the groove at a plate's edge. */
  relief: Float32Array;
}

type Segment = number[];
interface Part {
  region: string;
  subpaths: Segment[][];
}

/** How far a plate rises from its edge to full height, in map pixels (about a millimetre each). */
const RISE = 11;

function flatten(subpath: Segment[]) {
  const points: [number, number][] = [];
  let [x, y] = subpath[0];
  points.push([x, y]);
  for (const segment of subpath.slice(1)) {
    if (segment.length === 2) {
      [x, y] = segment;
      points.push([x, y]);
      continue;
    }
    const [x1, y1, x2, y2, x3, y3] = segment;
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const u = 1 - t;
      points.push([
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
    [x, y] = [x3, y3];
  }
  return points;
}

/** Fills a part's subpaths with the even-odd rule, sampling each pixel at its centre. */
function fill(part: Part, width: number, height: number, paint: (index: number) => void) {
  const polygons = part.subpaths.map(flatten);
  for (let row = 0; row < height; row++) {
    const y = row + 0.5;
    const crossings: number[] = [];
    for (const polygon of polygons) {
      for (let i = 0; i < polygon.length; i++) {
        const [ax, ay] = polygon[i];
        const [bx, by] = polygon[(i + 1) % polygon.length];
        if (ay <= y === by <= y) continue;
        crossings.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const to = Math.min(width - 1, Math.floor(crossings[i + 1] - 0.5));
      for (let x = from; x <= to; x++) paint(row * width + x);
    }
  }
}

/** Chamfer distance, in pixels, from every pixel to the nearest one where `source` is true. */
function distanceTo(source: (index: number) => boolean, width: number, height: number) {
  const d = new Float32Array(width * height).fill(1e9);
  for (let i = 0; i < d.length; i++) if (source(i)) d[i] = 0;
  const a = 1;
  const b = Math.SQRT2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + a);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - width] + a);
        if (x > 0) d[i] = Math.min(d[i], d[i - width - 1] + b);
        if (x < width - 1) d[i] = Math.min(d[i], d[i - width + 1] + b);
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) d[i] = Math.min(d[i], d[i + 1] + a);
      if (y < height - 1) {
        d[i] = Math.min(d[i], d[i + width] + a);
        if (x < width - 1) d[i] = Math.min(d[i], d[i + width + 1] + b);
        if (x > 0) d[i] = Math.min(d[i], d[i + width - 1] + b);
      }
    }
  }
  return d;
}

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export async function rasterizeBodyMap(): Promise<BodyMap> {
  const data = await Bun.file(join(import.meta.dir, "../../app-ios/Sources/CoreResources/Catalog/body.json")).json();
  const width = 1907;
  const height = 1876;
  const labels = new Int16Array(width * height).fill(-1);
  const parts = data.parts as Part[];
  for (const part of parts.filter((p) => p.region === "body" || p.region === "bone")) {
    fill(part, width, height, (i) => (labels[i] = 0));
  }
  for (const part of parts) {
    const muscle = MUSCLES.indexOf(part.region as (typeof MUSCLES)[number]);
    if (muscle >= 0) fill(part, width, height, (i) => (labels[i] = muscle + 1));
  }
  const toEdge = distanceTo(
    (i) => {
      const x = i % width;
      const own = labels[i];
      if (own <= 0) return true;
      return [i - 1, i + 1, i - width, i + width].some(
        (n) => n < 0 || n >= labels.length || Math.abs((n % width) - x) > 1 || labels[n] !== own,
      );
    },
    width,
    height,
  );
  const toPlate = distanceTo((i) => labels[i] > 0, width, height);
  const relief = new Float32Array(width * height);
  for (let i = 0; i < relief.length; i++) {
    // A plate climbs out of its groove; bare body between plates sinks into the groove the nearer a plate it is,
    // so a narrow gap stays a groove and wide bare skin (knees, hands, head) sits at the surface.
    relief[i] = labels[i] > 0 ? smoothstep(toEdge[i] / RISE) : smoothstep((toPlate[i] - 1) / RISE);
  }
  return { width, height, labels, relief };
}

/** The map pixel nearest a point, kept on the body: a point that lands just outside snaps inward. */
export function sampleMap(map: BodyMap, x: number, y: number) {
  const cx = Math.min(map.width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(map.height - 1, Math.max(0, Math.round(y)));
  let index = cy * map.width + cx;
  if (map.labels[index] < 0) {
    let best = -1;
    let bestDistance = Infinity;
    for (let r = 1; r <= 40 && best < 0; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
          const n = ny * map.width + nx;
          const distance = dx * dx + dy * dy;
          if (map.labels[n] >= 0 && distance < bestDistance) {
            best = n;
            bestDistance = distance;
          }
        }
      }
    }
    if (best >= 0) index = best;
  }
  return { label: Math.max(0, map.labels[index]), relief: map.labels[index] < 0 ? 1 : map.relief[index] };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** An 8-bit RGB PNG, with no colour profile so the browser hands the bytes to WebGL unchanged. */
export function encodePng(rgb: Uint8Array, width: number, height: number) {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
