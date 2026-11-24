import { Quaternion, Vector3 } from "three";
import { createBody, fk, newFrame, worldPoint, type Body } from "./body";
import { propParts, type Part, type PropState } from "./equipment";
import type { Sequence } from "./exercise";

export type View = "side" | "front" | "top" | "angle";

const project = (view: View, p: Vector3): [number, number, number] => {
  if (view === "side") return [p.z, p.y, p.x];
  if (view === "front") return [-p.x, p.y, p.z];
  if (view === "top") return [p.x, -p.z, p.y];
  // 3/4 isometric angle (yaw 38°, pitch 18°)
  const cy = Math.cos(0.66);
  const sy = Math.sin(0.66);
  const cp = Math.cos(0.31);
  const sp = Math.sin(0.31);
  const rx = p.x * cy + p.z * sy;
  const rz = -p.x * sy + p.z * cy;
  return [rx, p.y * cp - rz * sp, p.y * sp + rz * cp];
};

function hull(points: [number, number][]) {
  const sorted = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0)
        out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...build(sorted), ...build(sorted.toReversed())];
}

interface Drawn {
  depth: number;
  svg: string;
}

const MATERIAL: Record<string, string> = {
  steel: "#5d626b",
  chrome: "#c3c7ce",
  pad: "#33363c",
  plate: "#1d1e21",
  rubber: "#8a4b3c",
  cable: "#9ba3b0",
  band: "#e06d53",
  wood: "#8c6946",
  accent: "#3b82f6",
};

function drawPart(
  part: Part,
  view: View,
  at: (x: number, y: number) => string,
  scale: number,
  state?: PropState,
): Drawn {
  const quat = new Quaternion(...part.quat);
  const pos = new Vector3(...part.pos);
  if (state) {
    const propQuat = new Quaternion(...state.quat);
    pos.applyQuaternion(propQuat).add(new Vector3(...state.pos));
    quat.premultiply(propQuat);
  }
  const fill = MATERIAL[part.material] ?? "#5d626b";
  if (part.shape === "sphere") {
    const c = project(view, pos);
    return {
      depth: c[2],
      svg: `<circle cx="${at(c[0], c[1]).replace(",", '" cy="')}" r="${(part.size[0] * scale).toFixed(1)}" fill="${fill}" stroke="#0c0c0d" stroke-width="1"/>`,
    };
  }
  if (part.shape === "capsule") {
    const half = new Vector3(part.size[1] / 2, 0, 0).applyQuaternion(quat);
    const a = project(view, pos.clone().sub(half));
    const b = project(view, pos.clone().add(half));
    const w = Math.max(2, part.size[0] * 2 * scale);
    const line = (stroke: string, sw: number) =>
      `<line x1="${at(a[0], a[1]).replace(",", '" y1="')}" x2="${at(b[0], b[1]).replace(",", '" y2="')}" stroke="${stroke}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`;
    return { depth: Math.max(a[2], b[2]), svg: line("#0c0c0d", w + 2) + line(fill, w) };
  }
  const corners: Vector3[] = [];
  const [sx, sy, sz] =
    part.shape === "box" ? part.size : [part.size[1], part.size[0] * 2, part.size[0] * 2];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        corners.push(
          new Vector3((x * sx) / 2, (y * sy) / 2, (z * sz) / 2).applyQuaternion(quat).add(pos),
        );
      }
  const projected = corners.map((corner) => project(view, corner));
  const depth = Math.max(...projected.map((point) => point[2]));
  const axis = project(view, new Vector3(1, 0, 0).applyQuaternion(quat));
  if (part.shape === "cylinder" && Math.hypot(axis[0], axis[1]) < 0.2) {
    const c = project(view, pos);
    return {
      depth,
      svg: `<circle cx="${at(c[0], c[1]).replace(",", '" cy="')}" r="${(part.size[0] * scale).toFixed(1)}" fill="${fill}" stroke="#0c0c0d" stroke-width="1"/>`,
    };
  }
  const outline = hull(projected.map((point) => [point[0], point[1]] as [number, number]));
  return {
    depth,
    svg: `<polygon points="${outline.map((point) => at(point[0], point[1])).join(" ")}" fill="${fill}" stroke="#0c0c0d" stroke-width="1"/>`,
  };
}

/** A grid of orthographic stills, one row per view and one column per frame, for reviewing a rep without a browser. */
export function contactSheet(
  sequence: Sequence,
  frames: number[],
  views: View[] = ["side", "front", "angle"],
  body: Body = createBody(sequence.lifter.height, sequence.lifter.mass),
) {
  const cell = { w: 360, h: 420 };
  const scale = 155;
  const out: string[] = [];
  const frame = newFrame(body);
  views.forEach((view, row) => {
    frames.forEach((index, column) => {
      fk(body, sequence.poses[index], frame);
      const root = frame.pos[0];
      const pRoot = project(view, new Vector3(root.x, 0.95, root.z));
      const center =
        view === "top"
          ? [root.x, -root.z]
          : view === "side"
            ? [root.z, 0.95]
            : view === "front"
              ? [-root.x, 0.95]
              : [pRoot[0], pRoot[1]];
      const ox = column * cell.w + cell.w / 2;
      const oy = row * cell.h + cell.h / 2;
      const at = (x: number, y: number) =>
        `${(ox + (x - center[0]) * scale).toFixed(1)},${(oy - (y - center[1]) * scale).toFixed(1)}`;
      const drawn: Drawn[] = [];
      for (const part of sequence.equipment) drawn.push(drawPart(part, view, at, scale));
      sequence.props.forEach((prop, p) => {
        for (const part of propParts(prop, sequence.loadKg))
          drawn.push(drawPart(part, view, at, scale, sequence.propStates[index][p]));
      });
      if (sequence.tethers && sequence.tetherStates?.[index]) {
        sequence.tethers.forEach((tether, tIdx) => {
          const st = sequence.tetherStates![index][tIdx];
          const pts = st.points.map((pt) => project(view, new Vector3(...pt)));
          const stroke = tether.kind === "band" ? "#e06d53" : "#cbd5e1";
          const sw = tether.kind === "band" ? 4.5 : 2.2;
          drawn.push({
            depth: Math.max(...pts.map((pt) => pt[2])) + 0.02,
            svg: `<polyline points="${pts.map((pt) => at(pt[0], pt[1])).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`,
          });
        });
      }
      for (const collider of body.colliders.filter((item) => item.visible)) {
        const a = project(view, worldPoint(frame, collider.joint, collider.a));
        const b = project(view, worldPoint(frame, collider.joint, collider.b));
        const width = (collider.ra + collider.rb) * scale;
        const fill = collider.id.endsWith("_R")
          ? "#6d7f9c"
          : collider.id.endsWith("_L")
            ? "#9aa9c2"
            : "#84909f";
        const line = (stroke: string, w: number) =>
          `<line x1="${at(a[0], a[1]).replace(",", '" y1="')}" x2="${at(b[0], b[1]).replace(",", '" y2="')}" stroke="${stroke}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
        drawn.push({
          depth: Math.max(a[2], b[2]) + 0.05,
          svg: line("#0c0c0d", width + 2) + line(fill, width),
        });
      }
      out.push(
        `<clipPath id="c${row}_${column}"><rect x="${column * cell.w}" y="${row * cell.h}" width="${cell.w}" height="${cell.h}"/></clipPath>`,
      );
      out.push(`<g clip-path="url(#c${row}_${column})">`);
      if (view === "side" || view === "front")
        out.push(
          `<line x1="${column * cell.w}" x2="${(column + 1) * cell.w}" y1="${at(0, 0).split(",")[1]}" y2="${at(0, 0).split(",")[1]}" stroke="#3a3a3a"/>`,
        );
      out.push(...drawn.toSorted((a, b) => a.depth - b.depth).map((item) => item.svg));
      out.push(
        `<text x="${column * cell.w + 8}" y="${row * cell.h + 18}" fill="#aaa" font-family="monospace" font-size="12">${view} · frame ${index} · s=${sequence.s[index].toFixed(2)}</text>`,
      );
      out.push("</g>");
    });
  });
  const width = frames.length * cell.w;
  const height = views.length * cell.h;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#151414"/>${out.join("")}</svg>`;
}
