import { Euler, Quaternion, Vector3 } from "three";
import type { Vec3 } from "./math";

export type Material =
  | "steel"
  | "chrome"
  | "pad"
  | "plate"
  | "rubber"
  | "cable"
  | "band"
  | "wood"
  | "accent";

/**
 * Equipment primitive:
 * - `box`: `size` is full extents `[width, height, depth]`
 * - `cylinder`: `size` is `[radius, length, 0]`, axis along local X
 * - `capsule`: `size` is `[radius, shaftLength, 0]`, axis along local X
 * - `sphere`: `size` is `[radius, 0, 0]`
 */
export interface Part {
  id: string;
  shape: "box" | "cylinder" | "capsule" | "sphere";
  size: Vec3;
  pos: Vec3;
  quat: [number, number, number, number];
  material: Material;
  /** False for parts the lifter can't reach, which the clipping check skips. */
  collide: boolean;
}

export type BarbellStyle = "straight" | "ez" | "trap" | "ssb" | "axle" | "cambered";

export type PropDef =
  | {
      id: string;
      kind: "barbell";
      barKg: number;
      collarX: number;
      length: number;
      radius?: number;
      style?: BarbellStyle;
    }
  | { id: string; kind: "dumbbell"; fatGrip?: boolean }
  | { id: string; kind: "kettlebell" }
  | { id: string; kind: "plate" }
  | { id: string; kind: "medball" }
  | { id: string; kind: "parts"; parts: Part[]; /** Collider-only moving prop rendered by an articulated GLB node. */ hidden?: boolean }
  | {
      id: string;
      kind: "glb";
      /** Debranded or rigged model id from `exercise-motion/dist/gym/models/<glbId>.glb`. */
      glbId: string;
      scale?: number;
      offset?: Vec3;
      quat?: [number, number, number, number];
      /** Parametric collision/contact shapes in prop local space (invisible when GLB loads). */
      colliders?: Part[];
    };

export interface PropState {
  pos: Vec3;
  quat: [number, number, number, number];
}

export interface TetherDef {
  id: string;
  kind: "cable" | "band";
  radius?: number;
}

export interface TetherState {
  /** World-space polyline of 2 or more points (e.g. pulley -> handle). */
  points: Vec3[];
}

export interface GlbRef {
  /** Model id from `exercise-motion/dist/gym/models/<id>.glb`. */
  id: string;
  pos: Vec3;
  quat?: [number, number, number, number];
  scale?: number;
  /** Hide static parametric `equipment` meshes in the 3D viewer once this GLB loads (physics colliders stay active). */
  hideEquipment?: boolean;
  /** Hide only parametric `equipment` parts whose id starts with one of these prefixes. */
  hideEquipmentIds?: string[];
}

export interface GlbNodePose {
  /** Named node inside the loaded GLB (`gltf.scene.getObjectByName(node)`). */
  node: string;
  /** Local position offset added to the node's bind-pose position. */
  posOffset?: Vec3;
  /** Absolute local position override. */
  pos?: Vec3;
  /** Euler rotation offset `[rx, ry, rz]` (radians, XYZ) applied on top of bind-pose quaternion. */
  rotOffset?: Vec3;
  /** Absolute local quaternion override `[x, y, z, w]`. */
  quat?: [number, number, number, number];
}

export const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

export const quatOf = (axis: Vec3, angle: number): [number, number, number, number] => {
  const q = new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), angle);
  return [q.x, q.y, q.z, q.w];
};

export const quatEuler = (x: number, y: number, z: number): [number, number, number, number] => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, "YXZ"));
  return [q.x, q.y, q.z, q.w];
};

export const ALONG_Y = quatOf([0, 0, 1], Math.PI / 2);
export const ALONG_Z = quatOf([0, 1, 0], Math.PI / 2);

export const box = (
  id: string,
  pos: Vec3,
  size: Vec3,
  material: Material,
  collide = true,
  quat: [number, number, number, number] = IDENTITY,
): Part => ({
  id,
  shape: "box",
  size,
  pos,
  quat,
  material,
  collide,
});

export const cylinder = (
  id: string,
  pos: Vec3,
  radius: number,
  length: number,
  material: Material,
  quat: [number, number, number, number] = IDENTITY,
  collide = true,
): Part => ({ id, shape: "cylinder", size: [radius, length, 0], pos, quat, material, collide });

export const capsule = (
  id: string,
  pos: Vec3,
  radius: number,
  length: number,
  material: Material,
  quat: [number, number, number, number] = IDENTITY,
  collide = true,
): Part => ({ id, shape: "capsule", size: [radius, length, 0], pos, quat, material, collide });

export const sphere = (
  id: string,
  pos: Vec3,
  radius: number,
  material: Material,
  collide = true,
): Part => ({ id, shape: "sphere", size: [radius, 0, 0], pos, quat: IDENTITY, material, collide });

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

export const kettlebellSize = (kg: number) => {
  const radius = Math.min(0.12, Math.max(0.055, 0.055 + 0.0022 * kg));
  return { radius, handleY: radius + 0.055, handleWidth: radius * 1.4 };
};

/** A prop's parts in its own frame, the bar or handle along local X, for the weight it carries. */
export function propParts(prop: PropDef, loadKg: number): Part[] {
  if (prop.kind === "parts") return prop.parts;
  if (prop.kind === "glb") return prop.colliders ?? [];

  if (prop.kind === "dumbbell") {
    const head = dumbbellHead(loadKg);
    const offset = DUMBBELL_HANDLE / 2 + head.thickness / 2;
    const handleR = prop.fatGrip ? 0.026 : 0.016;
    return [
      cylinder(`${prop.id}.handle`, [0, 0, 0], handleR, DUMBBELL_HANDLE, prop.fatGrip ? "accent" : "chrome"),
      cylinder(`${prop.id}.head1`, [offset, 0, 0], head.radius, head.thickness, "plate"),
      cylinder(`${prop.id}.head2`, [-offset, 0, 0], head.radius, head.thickness, "plate"),
    ];
  }

  if (prop.kind === "kettlebell") {
    // Handle centered at origin along local X; bell hangs below (-Y) so grip anchor sits directly on the handle.
    const kb = kettlebellSize(loadKg);
    const r = kb.radius;
    const postH = 0.075;
    const halfW = kb.handleWidth / 2;
    return [
      cylinder(`${prop.id}.handle`, [0, 0, 0], 0.016, kb.handleWidth, "steel"),
      cylinder(`${prop.id}.postL`, [halfW, -postH / 2, 0], 0.014, postH, "steel", ALONG_Y),
      cylinder(`${prop.id}.postR`, [-halfW, -postH / 2, 0], 0.014, postH, "steel", ALONG_Y),
      sphere(`${prop.id}.bell`, [0, -postH - r * 0.72, 0], r, "plate"),
    ];
  }

  if (prop.kind === "plate") {
    const radius = Math.min(0.225, Math.max(0.11, 0.1 + 0.006 * loadKg));
    const thickness = Math.min(0.05, Math.max(0.02, 0.018 + 0.0012 * loadKg));
    return [cylinder(`${prop.id}.disc`, [0, 0, 0], radius, thickness, "plate", ALONG_Z)];
  }

  if (prop.kind === "medball") {
    const radius = Math.min(0.18, Math.max(0.11, 0.11 + 0.005 * loadKg));
    return [sphere(`${prop.id}.ball`, [0, 0, 0], radius, "rubber")];
  }

  const barRadius = prop.radius ?? (prop.style === "axle" ? 0.025 : BAR_RADIUS);
  const sleeve = Math.max(0.1, prop.length / 2 - prop.collarX);
  const parts: Part[] = [];
  if (prop.style === "trap") {
    // Hex frame around the lifter; handles sit at ±0.31 m along local X running along Z.
    const hw = 0.31;
    const hd = 0.32;
    parts.push(
      cylinder(`${prop.id}.handleL`, [hw, 0, 0], 0.016, 0.24, "chrome", ALONG_Z),
      cylinder(`${prop.id}.handleR`, [-hw, 0, 0], 0.016, 0.24, "chrome", ALONG_Z),
      box(`${prop.id}.front`, [0, 0, hd], [hw * 2, 0.036, 0.036], "steel"),
      box(`${prop.id}.back`, [0, 0, -hd], [hw * 2, 0.036, 0.036], "steel"),
      box(`${prop.id}.sideL`, [hw + 0.08, 0, 0], [0.036, 0.036, hd * 2], "steel"),
      box(`${prop.id}.sideR`, [-hw - 0.08, 0, 0], [0.036, 0.036, hd * 2], "steel"),
    );
  } else if (prop.style === "ssb") {
    parts.push(
      cylinder(`${prop.id}.shaft`, [0, 0, 0], 0.016, prop.collarX * 2, "chrome"),
      capsule(`${prop.id}.yokePad`, [0, 0, 0], 0.048, 0.34, "pad"),
      cylinder(`${prop.id}.armL`, [0.16, -0.1, 0.16], 0.022, 0.32, "pad", ALONG_Z),
      cylinder(`${prop.id}.armR`, [-0.16, -0.1, 0.16], 0.022, 0.32, "pad", ALONG_Z),
    );
  } else {
    parts.push(
      cylinder(`${prop.id}.shaft`, [0, 0, 0], barRadius, prop.collarX * 2, "chrome"),
    );
  }
  parts.push(
    cylinder(`${prop.id}.sleeve1`, [prop.collarX + sleeve / 2, 0, 0], 0.025, sleeve, "chrome"),
    cylinder(`${prop.id}.sleeve2`, [-prop.collarX - sleeve / 2, 0, 0], 0.025, sleeve, "chrome"),
    cylinder(`${prop.id}.collar1`, [prop.collarX + 0.01, 0, 0], 0.04, 0.02, "steel"),
    cylinder(`${prop.id}.collar2`, [-prop.collarX - 0.01, 0, 0], 0.04, 0.02, "steel"),
  );
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
        : part.shape === "sphere"
          ? part.size[0]
          : part.shape === "capsule"
            ? part.size[1] / 2 + part.size[0]
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
  if (shape.part.shape === "sphere") {
    return p.length() - size[0];
  }
  if (shape.part.shape === "capsule") {
    const clampedX = Math.max(-size[1] / 2, Math.min(size[1] / 2, p.x));
    return Math.hypot(p.x - clampedX, p.y, p.z) - size[0];
  }
  const radial = Math.hypot(p.y, p.z) - size[0];
  const axial = Math.abs(p.x) - size[1] / 2;
  return Math.hypot(Math.max(radial, 0), Math.max(axial, 0)) + Math.min(Math.max(radial, axial), 0);
}

export * from "./equipment-library";
