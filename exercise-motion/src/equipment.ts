import { Quaternion, Vector3 } from "three";
import type { Vec3 } from "./math";

export type Material = "steel" | "chrome" | "pad" | "plate" | "rubber";

/** A box (`size` is its full extents) or a cylinder (`size` is `[radius, length, 0]`, the axis along local X). */
export interface Part {
  id: string;
  shape: "box" | "cylinder";
  size: Vec3;
  pos: Vec3;
  quat: [number, number, number, number];
  material: Material;
  /** False for parts the lifter can't reach, which the clipping check skips. */
  collide: boolean;
}

export type PropDef =
  | { id: string; kind: "barbell"; barKg: number; collarX: number; length: number }
  | { id: string; kind: "dumbbell" };

export interface PropState {
  pos: Vec3;
  quat: [number, number, number, number];
}

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];
const quatOf = (axis: Vec3, angle: number): [number, number, number, number] => {
  const q = new Quaternion().setFromAxisAngle(new Vector3(...axis), angle);
  return [q.x, q.y, q.z, q.w];
};
const ALONG_Y = quatOf([0, 0, 1], Math.PI / 2);
const ALONG_Z = quatOf([0, 1, 0], Math.PI / 2);

const box = (id: string, pos: Vec3, size: Vec3, material: Material, collide = true): Part => ({
  id,
  shape: "box",
  size,
  pos,
  quat: IDENTITY,
  material,
  collide,
});

const cylinder = (
  id: string,
  pos: Vec3,
  radius: number,
  length: number,
  material: Material,
  quat = IDENTITY,
  collide = true,
): Part => ({ id, shape: "cylinder", size: [radius, length, 0], pos, quat, material, collide });

export const BAR_RADIUS = 0.0145;
const PLATES: [kg: number, radius: number, thickness: number][] = [
  [25, 0.225, 0.045],
  [20, 0.225, 0.038],
  [15, 0.2, 0.034],
  [10, 0.16, 0.03],
  [5, 0.115, 0.024],
  [2.5, 0.095, 0.018],
  [1.25, 0.08, 0.014],
];

export function platesFor(perSideKg: number) {
  const plates: [number, number, number][] = [];
  let left = perSideKg;
  for (const plate of PLATES) {
    while (left >= plate[0] - 1e-6 && plates.length < 8) {
      plates.push(plate);
      left -= plate[0];
    }
  }
  return plates;
}

export const dumbbellHead = (kg: number) => ({
  radius: 0.045 + 0.0016 * kg,
  thickness: 0.04 + 0.0025 * kg,
});
const DUMBBELL_HANDLE = 0.13;

/** A prop's parts in its own frame, the bar or handle along local X, for the weight it carries. */
export function propParts(prop: PropDef, loadKg: number): Part[] {
  if (prop.kind === "dumbbell") {
    const head = dumbbellHead(loadKg);
    const offset = DUMBBELL_HANDLE / 2 + head.thickness / 2;
    return [
      cylinder(`${prop.id}.handle`, [0, 0, 0], 0.016, DUMBBELL_HANDLE, "chrome"),
      cylinder(`${prop.id}.head1`, [offset, 0, 0], head.radius, head.thickness, "plate"),
      cylinder(`${prop.id}.head2`, [-offset, 0, 0], head.radius, head.thickness, "plate"),
    ];
  }
  const sleeve = prop.length / 2 - prop.collarX;
  const parts = [
    cylinder(`${prop.id}.shaft`, [0, 0, 0], BAR_RADIUS, prop.collarX * 2, "chrome"),
    cylinder(`${prop.id}.sleeve1`, [prop.collarX + sleeve / 2, 0, 0], 0.025, sleeve, "chrome"),
    cylinder(`${prop.id}.sleeve2`, [-prop.collarX - sleeve / 2, 0, 0], 0.025, sleeve, "chrome"),
    cylinder(`${prop.id}.collar1`, [prop.collarX + 0.01, 0, 0], 0.04, 0.02, "steel"),
    cylinder(`${prop.id}.collar2`, [-prop.collarX - 0.01, 0, 0], 0.04, 0.02, "steel"),
  ];
  let x = prop.collarX + 0.02;
  platesFor(Math.max(0, (loadKg - prop.barKg) / 2)).forEach(([, radius, thickness], n) => {
    parts.push(
      cylinder(`${prop.id}.plate${n}a`, [x + thickness / 2, 0, 0], radius, thickness, "plate"),
    );
    parts.push(
      cylinder(`${prop.id}.plate${n}b`, [-x - thickness / 2, 0, 0], radius, thickness, "plate"),
    );
    x += thickness + 0.002;
  });
  return parts;
}

export interface SmithOptions {
  /** Height of the safety stops on the rails. */
  stopY: number;
  railX?: number;
  height?: number;
}

/** A Smith machine with vertical rails in the plane z = 0. */
export function smithMachine({ stopY, railX = 0.6, height = 2.1 }: SmithOptions): Part[] {
  const parts: Part[] = [];
  const depth = 0.55;
  for (const s of [1, -1]) {
    const x = s * (railX + 0.07);
    const tag = s > 0 ? "L" : "R";
    parts.push(box(`smith.base_${tag}`, [x, 0.04, 0], [0.1, 0.08, depth * 2 + 0.2], "steel"));
    for (const z of [depth, -depth]) {
      parts.push(
        box(
          `smith.upright_${tag}${z > 0 ? "f" : "b"}`,
          [x, height / 2, z],
          [0.06, height, 0.06],
          "steel",
        ),
      );
    }
    parts.push(box(`smith.top_${tag}`, [x, height, 0], [0.07, 0.07, depth * 2 + 0.07], "steel"));
    parts.push(
      cylinder(
        `smith.rail_${tag}`,
        [s * railX, height / 2, 0],
        0.015,
        height - 0.1,
        "chrome",
        ALONG_Y,
      ),
    );
    parts.push(
      box(`smith.stop_${tag}`, [s * railX, stopY - 0.03, 0], [0.07, 0.06, 0.09], "rubber"),
    );
  }
  parts.push(
    box("smith.crossFront", [0, height, depth], [railX * 2 + 0.21, 0.07, 0.07], "steel", false),
  );
  parts.push(
    box("smith.crossBack", [0, height, -depth], [railX * 2 + 0.21, 0.07, 0.07], "steel", false),
  );
  return parts;
}

export interface BenchOptions {
  topY: number;
  zHead: number;
  zFoot: number;
  width?: number;
}

/** A flat bench along Z with its pad's top surface at `topY`. */
export function flatBench({ topY, zHead, zFoot, width = 0.29 }: BenchOptions): Part[] {
  const mid = (zHead + zFoot) / 2;
  const length = Math.abs(zFoot - zHead);
  const pad = 0.065;
  const legY = (topY - pad) / 2;
  return [
    box("bench.pad", [0, topY - pad / 2, mid], [width, pad, length], "pad"),
    box("bench.spine", [0, topY - pad - 0.03, mid], [0.07, 0.06, length - 0.12], "steel"),
    box(
      "bench.legHead",
      [0, legY, zHead + Math.sign(zFoot - zHead) * 0.14],
      [0.06, topY - pad, 0.06],
      "steel",
    ),
    box(
      "bench.legFoot",
      [0, legY, zFoot - Math.sign(zFoot - zHead) * 0.2],
      [0.06, topY - pad, 0.06],
      "steel",
    ),
    box(
      "bench.footHead",
      [0, 0.025, zHead + Math.sign(zFoot - zHead) * 0.14],
      [0.5, 0.05, 0.07],
      "steel",
    ),
    box(
      "bench.footFoot",
      [0, 0.025, zFoot - Math.sign(zFoot - zHead) * 0.2],
      [0.36, 0.05, 0.07],
      "steel",
    ),
  ];
}

export interface RackOptions {
  /** Where the uprights stand along the bench. */
  z: number;
  /** Top of the J-hooks' cradle, where the racked bar's underside rests. */
  hookY: number;
  safetyY: number;
  /** How far the safety arms reach from the uprights, toward the lifter's feet when positive. */
  safetyReach: number;
  uprightX?: number;
  height?: number;
}

/** Two uprights with J-hooks and safety arms, as in a power rack or bench press station. */
export function benchRack({
  z,
  hookY,
  safetyY,
  safetyReach,
  uprightX = 0.6,
  height = 1.5,
}: RackOptions): Part[] {
  const parts: Part[] = [];
  const dir = Math.sign(safetyReach);
  for (const s of [1, -1]) {
    const tag = s > 0 ? "L" : "R";
    const x = s * uprightX;
    parts.push(
      box(`rack.upright_${tag}`, [x, height / 2, z - dir * 0.065], [0.075, height, 0.075], "steel"),
    );
    parts.push(
      box(
        `rack.base_${tag}`,
        [x, 0.035, z + safetyReach / 2 - dir * 0.2],
        [0.075, 0.07, Math.abs(safetyReach) + 0.5],
        "steel",
      ),
    );
    parts.push(
      box(`rack.hook_${tag}`, [x, hookY - 0.012, z + dir * 0.012], [0.06, 0.024, 0.08], "steel"),
    );
    parts.push(
      box(`rack.hookLip_${tag}`, [x, hookY + 0.02, z + dir * 0.046], [0.06, 0.07, 0.012], "steel"),
    );
    parts.push(
      box(
        `rack.safety_${tag}`,
        [x, safetyY - 0.025, z + safetyReach / 2],
        [0.06, 0.05, Math.abs(safetyReach)],
        "steel",
      ),
    );
  }
  parts.push(
    box("rack.cross", [0, 0.12, z - dir * 0.065], [uprightX * 2, 0.06, 0.06], "steel", false),
  );
  return parts;
}

export interface Shape {
  part: Part;
  pos: Vector3;
  inverse: Quaternion;
  bound: number;
}

export const compileParts = (parts: Part[], state?: PropState): Shape[] =>
  parts.map((part) => {
    const quat = new Quaternion(...part.quat);
    const pos = new Vector3(...part.pos);
    if (state) {
      const propQuat = new Quaternion(...state.quat);
      pos.applyQuaternion(propQuat).add(new Vector3(...state.pos));
      quat.premultiply(propQuat);
    }
    const bound =
      part.shape === "box"
        ? Math.hypot(...part.size) / 2
        : Math.hypot(part.size[0], part.size[1] / 2);
    return { part, pos, inverse: quat.invert(), bound };
  });

const p = new Vector3();

/** Signed distance from a world point to a part's surface, negative inside. */
export function signedDistance(shape: Shape, point: Vector3) {
  p.copy(point).sub(shape.pos).applyQuaternion(shape.inverse);
  const size = shape.part.size;
  if (shape.part.shape === "box") {
    const dx = Math.abs(p.x) - size[0] / 2;
    const dy = Math.abs(p.y) - size[1] / 2;
    const dz = Math.abs(p.z) - size[2] / 2;
    return (
      Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) +
      Math.min(Math.max(dx, dy, dz), 0)
    );
  }
  const radial = Math.hypot(p.y, p.z) - size[0];
  const axial = Math.abs(p.x) - size[1] / 2;
  return Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) + Math.min(Math.max(radial, axial), 0);
}

export { ALONG_Y, ALONG_Z };
