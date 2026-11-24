#!/usr/bin/env bun
import { join } from "node:path";
import { Matrix4, Quaternion, Vector3 } from "three";
import { createBody, fk, makePose, newFrame, SIDES, sideSign, type Side } from "../src/body";
import { encodeLifter, type FingerBone, type LifterAsset } from "../viewer/lifter-asset";
import { rotationCenters } from "./centers";
import { encodePng, rasterizeBodyMap, sampleMap } from "./muscle-map";
import { applyTarget, jointPosition, loadBaseMesh, loadSkeleton, MAKEHUMAN_COMMIT } from "./makehuman";
import { subdivide, type QuadMesh } from "./subdivide";

/**
 * Builds the lifter's mesh from MakeHuman's CC0 base mesh: a young adult male at maximum muscle, fitted to the rig's
 * segment lengths and bound to its joints with MakeHuman's own skin weights. The output is committed, so building the
 * viewer needs neither the network nor this script.
 */

const OUT = join(import.meta.dir, "../viewer/assets/lifter.bin");
const body = createBody();

const mesh = await loadBaseMesh();
const skeleton = await loadSkeleton();
const positions = mesh.positions;
await applyTarget(positions, "targets/macrodetails/caucasian-male-young.target", 1);
// Maximum muscle, between average and minimum body fat: defined but not stage-lean.
await applyTarget(positions, "targets/macrodetails/universal-male-young-maxmuscle-averageweight.target", 0.45);
await applyTarget(positions, "targets/macrodetails/universal-male-young-maxmuscle-minweight.target", 0.55);
// The macro's maximum still reads as an ordinary build, so each region's own muscle target is added on top.
const SHAPE: [string, number][] = [
  ["torso/torso-muscle-pectoral-incr", 1],
  ["torso/torso-muscle-dorsi-incr", 1],
  ["torso/torso-vshape-incr", 0.6],
  ["measure/measure-shoulder-dist-incr", 0.4],
  ["measure/measure-waist-circ-decr", 0.4],
  ["measure/measure-neck-circ-incr", 0.6],
  ["stomach/stomach-tone-incr", 1],
  ["buttocks/buttocks-volume-incr", 0.3],
  // MakeHuman's upper arm is short for its height. Lengthening it here keeps the fit to the rig from stretching it.
  ["measure/measure-upperarm-length-incr", 1],
];
for (const side of ["l", "r"]) {
  SHAPE.push(
    [`armslegs/${side}-upperarm-muscle-incr`, 1],
    [`armslegs/${side}-upperarm-shoulder-muscle-incr`, 1],
    [`armslegs/${side}-lowerarm-muscle-incr`, 0.8],
    [`armslegs/${side}-upperleg-muscle-incr`, 1],
    [`armslegs/${side}-lowerleg-muscle-incr`, 0.8],
  );
}
for (const [target, weight] of SHAPE) await applyTarget(positions, `targets/${target}.target`, weight);

// MakeHuman works in decimetres. Scale it to the rig's height with the soles on the floor.
const used = [...new Set(mesh.quads)].sort((a, b) => a - b);
let floor = Infinity;
let top = -Infinity;
for (const v of used) {
  floor = Math.min(floor, positions[v * 3 + 1]);
  top = Math.max(top, positions[v * 3 + 1]);
}
const scale = body.height / (top - floor);
for (let v = 0; v < positions.length / 3; v++) {
  positions[v * 3] *= scale;
  positions[v * 3 + 1] = (positions[v * 3 + 1] - floor) * scale;
  positions[v * 3 + 2] *= scale;
}
const head = (bone: string) => new Vector3(...jointPosition(skeleton, positions, `${bone}____head`));
const tail = (bone: string) => new Vector3(...jointPosition(skeleton, positions, `${bone}____tail`));

/** The rotation taking the orthonormal frame built from (a1, a2) onto the one built from (b1, b2). */
function alignFrames(a1: Vector3, a2: Vector3, b1: Vector3, b2: Vector3) {
  const basis = (primary: Vector3, secondary: Vector3) => {
    const e1 = primary.clone().normalize();
    const e2 = secondary.clone().addScaledVector(e1, -secondary.dot(e1)).normalize();
    return new Matrix4().makeBasis(e1, e2, e1.clone().cross(e2));
  };
  const from = basis(a1, a2);
  return new Quaternion().setFromRotationMatrix(basis(b1, b2).multiply(from.transpose()));
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const DOWN = new Vector3(0, -1, 0);

function arm(side: Side) {
  const shoulder = head(`upperarm01.${side}`);
  const elbow = head(`lowerarm01.${side}`);
  const wrist = head(`wrist.${side}`);
  const upper = elbow.clone().sub(shoulder);
  const fore = wrist.clone().sub(elbow);
  return {
    shoulder,
    elbow,
    wrist,
    upper,
    fore,
    hinge: fore.clone().normalize().cross(upper.clone().normalize()).normalize(),
    hand: tail(`metacarpal2.${side}`).sub(wrist),
    thumb: head(`finger1-2.${side}`).sub(wrist),
  };
}

interface Segment {
  /** Where the segment's joint sits on the MakeHuman body. */
  origin: Vector3;
  /** The joint's world rotation in the bind pose, which follows MakeHuman's rest pose. */
  rotation: Quaternion;
  /** The rig's segment length over MakeHuman's, applied along `axis`. */
  stretch: number;
  axis: Vector3;
}

const segments: Segment[] = [];
const bind: Vector3[] = [];
for (const joint of body.joints) {
  const s = joint.side ?? "L";
  const limb = arm(s);
  const length = (child: string) => body.joints[body.index[child]].offset.length();
  let origin: Vector3;
  let rotation = new Quaternion();
  let stretch = 1;
  let axis = DOWN.clone();
  const base = joint.name.replace(/_[LR]$/, "");
  if (base === "pelvis") {
    origin = head("upperleg01.L").add(head("upperleg01.R")).multiplyScalar(0.5);
  } else if (base === "lumbar") {
    origin = head("spine04");
  } else if (base === "thoracic") {
    origin = head("spine02");
    rotation = alignFrames(Y, X, head("neck01").sub(origin), X);
  } else if (base === "neck") {
    origin = head("neck01");
  } else if (base === "clavicle") {
    origin = head(`clavicle.${s}`);
    rotation = alignFrames(body.joints[body.index[`shoulder_${s}`]].offset, Y, limb.shoulder.clone().sub(origin), Y);
  } else if (base === "shoulder") {
    origin = limb.shoulder;
    rotation = alignFrames(DOWN, X, limb.upper, limb.hinge);
    stretch = length(`elbow_${s}`) / limb.upper.length();
  } else if (base === "elbow" || base === "forearm") {
    origin = limb.elbow;
    rotation = base === "elbow" ? alignFrames(DOWN, X, limb.fore, limb.hinge) : alignFrames(DOWN, Z, limb.fore, limb.thumb);
    stretch = length(`wrist_${s}`) / limb.fore.length();
  } else if (base === "wrist") {
    origin = limb.wrist;
    rotation = alignFrames(DOWN, Z, limb.hand, limb.thumb);
  } else if (base === "hip") {
    origin = head(`upperleg01.${s}`);
    const thigh = head(`lowerleg01.${s}`).sub(origin);
    rotation = alignFrames(DOWN, X, thigh, X);
    stretch = length(`knee_${s}`) / thigh.length();
  } else if (base === "knee") {
    origin = head(`lowerleg01.${s}`);
    const shank = head(`foot.${s}`).sub(origin);
    rotation = alignFrames(DOWN, X, shank, X);
    stretch = length(`ankle_${s}`) / shank.length();
  } else if (base === "ankle") {
    origin = head(`foot.${s}`);
    rotation = alignFrames(Z, Y, head(`toe3-1.${s}`).sub(origin).setY(0), Y);
    axis = Z.clone();
  } else {
    throw new Error(`No MakeHuman landmark for joint ${joint.name}`);
  }
  segments.push({ origin, rotation, stretch, axis: axis.applyQuaternion(rotation) });
  bind.push(
    joint.parent < 0
      ? origin.clone()
      : joint.offset.clone().applyQuaternion(segments[joint.parent].rotation).add(bind[joint.parent]),
  );
}

// Fingers keep their own bones so the hands can close around a bar.
const fingers: FingerBone[] = [];
const fingerJoint: Record<string, number> = {};
for (const side of SIDES) {
  for (let finger = 1; finger <= 5; finger++) {
    for (let segment = 1; segment <= 3; segment++) {
      const name = `finger${finger}-${segment}.${side}`;
      fingerJoint[name] = body.joints.length + fingers.length;
      fingers.push({
        name,
        parent: segment === 1 ? `wrist_${side}` : `finger${finger}-${segment - 1}.${side}`,
        finger,
        segment,
        side,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
      });
    }
  }
}

// MakeHuman's bones, onto the rig's joints. Twist bones split the forearm so pronation fades in toward the wrist;
// anything not listed, the head and face, rides the neck.
const JOINT_OF_BONE: [RegExp, string][] = [
  [/^(root|pelvis\.[LR]|spine05)$/, "pelvis"],
  [/^(spine04|spine03)$/, "lumbar"],
  [/^(spine02|spine01|breast\.[LR])$/, "thoracic"],
  [/^clavicle\.([LR])$/, "clavicle_$1"],
  [/^(upperarm01|upperarm02)\.([LR])$/, "shoulder_$2"],
  [/^lowerarm01\.([LR])$/, "elbow_$1"],
  [/^lowerarm02\.([LR])$/, "forearm_$1"],
  [/^(wrist|metacarpal\d)\.([LR])$/, "wrist_$2"],
  [/^(upperleg01|upperleg02)\.([LR])$/, "hip_$2"],
  [/^(lowerleg01|lowerleg02)\.([LR])$/, "knee_$2"],
  [/^(foot|toe\d-\d)\.([LR])$/, "ankle_$2"],
];
const jointOfBone = (bone: string) => {
  if (fingerJoint[bone] !== undefined) return fingerJoint[bone];
  for (const [pattern, joint] of JOINT_OF_BONE) if (pattern.test(bone)) return body.index[bone.replace(pattern, joint)];
  return body.index.neck;
};

const influences: Map<number, number>[] = Array.from({ length: positions.length / 3 }, () => new Map());
// The deltoid cap moves partway with the arm, as the bone MakeHuman gives it does. Left on the collarbone it stays
// behind when the arm drops and leaves a shelf on top of the shoulder.
const DELTOID_ON_ARM = 0.8;
const jointsOfBone = (bone: string): [number, number][] => {
  const deltoid = bone.match(/^shoulder01\.([LR])$/);
  if (deltoid) {
    return [
      [body.index[`clavicle_${deltoid[1]}`], 1 - DELTOID_ON_ARM],
      [body.index[`shoulder_${deltoid[1]}`], DELTOID_ON_ARM],
    ];
  }
  return [[jointOfBone(bone), 1]];
};
for (const [bone, list] of Object.entries(skeleton.weights)) {
  for (const [joint, share] of jointsOfBone(bone)) {
    if (joint === undefined) throw new Error(`MakeHuman bone ${bone} maps to no joint`);
    for (const [v, w] of list) influences[v].set(joint, (influences[v].get(joint) ?? 0) + w * share);
  }
}
const headShare = new Float64Array(positions.length / 3);
{
  const total = new Float64Array(positions.length / 3);
  for (const [bone, list] of Object.entries(skeleton.weights)) {
    const onHead = jointOfBone(bone) === body.index.neck && !/^neck0\d$/.test(bone);
    for (const [v, w] of list) {
      total[v] += w;
      if (onHead) headShare[v] += w;
    }
  }
  for (let v = 0; v < total.length; v++) if (total[v] > 0) headShare[v] /= total[v];
}
const segmentOf = (joint: number) =>
  joint < body.joints.length ? joint : body.index[`wrist_${fingers[joint - body.joints.length].side}`];

/** Moves a MakeHuman point onto the rig: each segment carries it rigidly, stretched along its long axis. */
function retarget(point: Vector3, weights: Map<number, number>) {
  const out = new Vector3();
  const local = new Vector3();
  let total = 0;
  for (const [joint, w] of weights) {
    const j = segmentOf(joint);
    const segment = segments[j];
    local.copy(point).sub(segment.origin);
    local.addScaledVector(segment.axis, local.dot(segment.axis) * (segment.stretch - 1)).add(bind[j]);
    out.addScaledVector(local, w);
    total += w;
  }
  if (total === 0) throw new Error("A body vertex has no skin weight");
  return out.divideScalar(total);
}

for (const bone of fingers) {
  const j = body.index[`wrist_${bone.side}`];
  const toRig = (p: Vector3) => p.sub(segments[j].origin).add(bind[j]);
  const start = toRig(head(bone.name));
  const along = toRig(tail(bone.name)).sub(start);
  const limb = arm(bone.side);
  const palm = limb.hand.clone().normalize().cross(limb.thumb.clone().normalize()).multiplyScalar(sideSign(bone.side));
  const rotation = alignFrames(Y, X, along, along.clone().normalize().cross(palm));
  bone.position = start.toArray() as [number, number, number];
  bone.rotation = rotation.toArray() as [number, number, number, number];
}

// The body as a welded quad mesh on the rig, subdivided once for a smooth silhouette at close range.
const welded = new Map(used.map((v, i) => [v, i]));
const base: QuadMesh = {
  positions: new Float64Array(used.length * 3),
  weights: used.map((v) => influences[v]),
  quads: Uint32Array.from(mesh.quads, (v) => welded.get(v)!),
  uvs: Float64Array.from([...mesh.corners].flatMap((t) => [mesh.texcoords[t * 2], mesh.texcoords[t * 2 + 1]])),
  // How much of each vertex the head and face bones carry: the part of the body the muscle map leaves bare.
  mark: Float64Array.from(used, (v) => headShare[v]),
};
used.forEach((v, i) => {
  const moved = retarget(new Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]), influences[v]);
  base.positions.set(moved.toArray(), i * 3);
});
const fine = subdivide(base);
// Four influences per vertex, as the shader blends them.
fine.weights = fine.weights.map((map) => {
  const strongest = [...map].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = strongest.reduce((total, [, w]) => total + w, 0);
  return new Map(strongest.map(([joint, w]) => [joint, w / sum]));
});
const centers = rotationCenters(fine);

/** Smooth normals of a welded quad mesh. */
function weldedNormals(quadMesh: QuadMesh) {
  const vertexCount = quadMesh.positions.length / 3;
  const sum = new Float64Array(vertexCount * 3);
  const at = (v: number) => new Vector3().fromArray(quadMesh.positions, v * 3);
  for (let q = 0; q < quadMesh.quads.length / 4; q++) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => quadMesh.quads[q * 4 + k]);
    const n = at(c).sub(at(a)).cross(at(d).sub(at(b)));
    for (const v of [a, b, c, d]) for (let k = 0; k < 3; k++) sum[v * 3 + k] += n.getComponent(k);
  }
  for (let v = 0; v < vertexCount; v++) sum.set(new Vector3().fromArray(sum, v * 3).normalize().toArray(), v * 3);
  return sum;
}

// The muscle plates come from the app's flat body map. The body is posed like the drawing (arms a little out,
// palms forward), and each segment is mapped onto the same segment of the drawing, since the drawing is stylised:
// its elbows sit higher than an anatomical elbow would.
const DRAWING = { scale: body.height / 1876, front: 453, back: 1453 };
/** Joint centres in the drawing for the figure's left side, as pixels out from the midline and down from the top. */
const LANDMARKS: Record<string, [number, number]> = {
  shoulder: [200, 382],
  elbow: [240, 628],
  wrist: [300, 892],
  hip: [100, 872],
  knee: [115, 1350],
  ankle: [138, 1785],
};
const labelPose = fk(
  body,
  makePose(body, { "shoulder.elev": 11, "shoulder.plane": 0, "forearm.pron": -80, "elbow.flex": 2, "hip.abd": 2 }),
  newFrame(body),
);
const drawn = (joint: string): [number, number] => {
  const side = joint.endsWith("_R") ? -1 : 1;
  const [lateral, down] = LANDMARKS[joint.replace(/_[LR]$/, "")];
  return [side * lateral, down];
};
const projected = (joint: string): [number, number] => {
  const p = labelPose.pos[body.index[joint]];
  return [p.x / DRAWING.scale, (body.height - p.y) / DRAWING.scale];
};
/** A 2D similarity, as complex multiplication, taking a and b onto a2 and b2. */
function similarity(a: [number, number], b: [number, number], a2: [number, number], b2: [number, number]) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const [ex, ey] = [b2[0] - a2[0], b2[1] - a2[1]];
  const n = dx * dx + dy * dy;
  const [re, im] = [(ex * dx + ey * dy) / n, (ey * dx - ex * dy) / n];
  return (x: number, y: number): [number, number] => [
    a2[0] + re * (x - a[0]) - im * (y - a[1]),
    a2[1] + im * (x - a[0]) + re * (y - a[1]),
  ];
}
/** The affine map taking three points onto three others. */
function affine(from: [number, number][], to: [number, number][]) {
  const [[x0, y0], [x1, y1], [x2, y2]] = from;
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  const solve = (k: number) => {
    const [u0, u1, u2] = to.map((t) => t[k]);
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
    const b = ((x1 - x0) * (u2 - u0) - (x2 - x0) * (u1 - u0)) / det;
    return (x: number, y: number) => u0 + a * (x - x0) + b * (y - y0);
  };
  const [fx, fy] = [solve(0), solve(1)];
  return (x: number, y: number): [number, number] => [fx(x, y), fy(x, y)];
}
const torso = affine(
  [projected("shoulder_L"), projected("shoulder_R"), projected("pelvis")],
  [drawn("shoulder_L"), drawn("shoulder_R"), [0, (drawn("hip_L")[1] + drawn("hip_R")[1]) / 2]],
);
const segmentMap: Record<number, (x: number, y: number) => [number, number]> = {};
for (const joint of body.joints) {
  const s = joint.side;
  const base = joint.name.replace(/_[LR]$/, "");
  const limb = (from: string, to: string) =>
    similarity(projected(`${from}_${s}`), projected(`${to}_${s}`), drawn(`${from}_${s}`), drawn(`${to}_${s}`));
  segmentMap[joint.index] =
    base === "shoulder"
      ? limb("shoulder", "elbow")
      : base === "elbow" || base === "forearm" || base === "wrist"
        ? limb("elbow", "wrist")
        : base === "hip"
          ? limb("hip", "knee")
          : base === "knee" || base === "ankle"
            ? limb("knee", "ankle")
            : torso;
}
fingers.forEach((bone, f) => (segmentMap[body.joints.length + f] = segmentMap[body.index[`wrist_${bone.side}`]]));

/** Poses the welded mesh like the drawing with the same skinning the viewer runs, and places it on the drawing. */
function placeOnDrawing(quadMesh: QuadMesh, normals: Float64Array) {
  const skins = body.joints.map((joint) => {
    const rotation = segments[joint.index].rotation.clone().invert().premultiply(labelPose.rot[joint.index]);
    return { rotation, translation: bind[joint.index].clone().applyQuaternion(rotation).negate().add(labelPose.pos[joint.index]) };
  });
  const skinOf = (joint: number) => skins[segmentOf(joint)];
  const vertexCount = quadMesh.positions.length / 3;
  const out = new Float64Array(vertexCount * 3);
  const center = new Vector3();
  const carried = new Vector3();
  const blended = new Quaternion();
  for (let v = 0; v < vertexCount; v++) {
    center.fromArray(centers, v * 3);
    carried.set(0, 0, 0);
    let first: Quaternion | null = null;
    const sum = [0, 0, 0, 0];
    for (const [joint, w] of quadMesh.weights[v]) {
      const skin = skinOf(joint);
      first ??= skin.rotation;
      const sign = first.dot(skin.rotation) < 0 ? -w : w;
      sum[0] += sign * skin.rotation.x;
      sum[1] += sign * skin.rotation.y;
      sum[2] += sign * skin.rotation.z;
      sum[3] += sign * skin.rotation.w;
      carried.addScaledVector(center.clone().applyQuaternion(skin.rotation).add(skin.translation), w);
    }
    blended.set(sum[0], sum[1], sum[2], sum[3]).normalize();
    const posed = new Vector3().fromArray(quadMesh.positions, v * 3).sub(center).applyQuaternion(blended).add(carried);
    const facing = new Vector3().fromArray(normals, v * 3).applyQuaternion(blended).z;
    let lateral = 0;
    let down = 0;
    for (const [joint, w] of quadMesh.weights[v]) {
      const [x, y] = segmentMap[joint](posed.x / DRAWING.scale, (body.height - posed.y) / DRAWING.scale);
      lateral += w * x;
      down += w * y;
    }
    out.set([lateral, down, facing], v * 3);
  }
  return out;
}
const drawingPixel = (lateral: number, down: number, facing: number): [number, number] => [
  facing >= 0 ? DRAWING.front + lateral : DRAWING.back - lateral,
  down,
];

const bodyMap = await rasterizeBodyMap();
const onDrawing = placeOnDrawing(fine, weldedNormals(fine));
// The head stays bare: the drawing's neck plate would otherwise spill onto a jaw that sits lower than the drawing's.
const bare = Float64Array.from(fine.mark, (share) => (share > 0.5 ? 1 : 0));
{
  // Each plate stands proud of the grooves around it by this much.
  const GROOVE = 0.0035;
  const normals = weldedNormals(fine);
  for (let v = 0; v < fine.positions.length / 3; v++) {
    const [x, y] = drawingPixel(onDrawing[v * 3], onDrawing[v * 3 + 1], onDrawing[v * 3 + 2]);
    const relief = bare[v] ? 1 : sampleMap(bodyMap, x, y).relief;
    for (let k = 0; k < 3; k++) fine.positions[v * 3 + k] += normals[v * 3 + k] * (relief - 1) * GROOVE;
  }
}
// Normals come from the welded mesh, so they agree across a texture seam and leave no line in the shading.
const smooth = weldedNormals(fine);

// One vertex per distinct position and texture coordinate, so the muscle map can follow MakeHuman's UV layout.
const key = new Map<string, number>();
const vertexOf: number[] = [];
const uvOf: number[] = [];
const indices: number[] = [];
for (let q = 0; q < fine.quads.length / 4; q++) {
  const ids = [0, 1, 2, 3].map((k) => {
    const v = fine.quads[q * 4 + k];
    const corner = q * 4 + k;
    const id = `${v}/${fine.uvs[corner * 2].toFixed(6)}/${fine.uvs[corner * 2 + 1].toFixed(6)}`;
    if (!key.has(id)) {
      key.set(id, vertexOf.length);
      vertexOf.push(v);
      uvOf.push(corner);
    }
    return key.get(id)!;
  });
  indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
}
if (vertexOf.length > 65535) throw new Error(`${vertexOf.length} vertices do not fit 16-bit indices`);

const count = vertexOf.length;
const bindPositions = new Float32Array(count * 3);
const normals = new Float32Array(count * 3);
const rotationCenter = new Float32Array(count * 3);
const uvs = new Float32Array(count * 2);
const skinIndex = new Uint8Array(count * 4);
const skinWeight = new Uint8Array(count * 4);
for (let i = 0; i < count; i++) {
  const v = vertexOf[i];
  bindPositions.set(fine.positions.subarray(v * 3, v * 3 + 3), i * 3);
  normals.set(smooth.subarray(v * 3, v * 3 + 3), i * 3);
  rotationCenter.set(centers.subarray(v * 3, v * 3 + 3), i * 3);
  uvs.set(fine.uvs.subarray(uvOf[i] * 2, uvOf[i] * 2 + 2), i * 2);
  const strongest = [...fine.weights[v]];
  // The strongest influence takes the rounding remainder, so the bytes always sum to 255 and none goes negative.
  const bytes = strongest.map(([, w]) => Math.floor(w * 255));
  bytes[0] += 255 - bytes.reduce((total, b) => total + b, 0);
  strongest.forEach(([joint], k) => {
    skinIndex[i * 4 + k] = joint;
    skinWeight[i * 4 + k] = bytes[k];
  });
}

// The muscle map in the body's own texture layout: red is the relief, green the plate (0 for bare skin, then the
// `Figure.tint` slot plus one: muscles in `MUSCLES` order, left then right).
const MAP_SIZE = 2048;
const mapRgb = new Uint8Array(MAP_SIZE * MAP_SIZE * 3);
const covered = new Uint8Array(MAP_SIZE * MAP_SIZE);
for (let t = 0; t < indices.length; t += 3) {
  const corners = [0, 1, 2].map((k) => {
    const i = indices[t + k];
    const v = vertexOf[i];
    return {
      x: uvs[i * 2] * MAP_SIZE,
      y: (1 - uvs[i * 2 + 1]) * MAP_SIZE,
      drawing: [onDrawing[v * 3], onDrawing[v * 3 + 1], onDrawing[v * 3 + 2], bare[v]],
    };
  });
  const [a, b, c] = corners;
  const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(area) < 1e-12) continue;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(MAP_SIZE - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(MAP_SIZE - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const wa = ((b.x - px) * (c.y - py) - (c.x - px) * (b.y - py)) / area;
      const wb = ((c.x - px) * (a.y - py) - (a.x - px) * (c.y - py)) / area;
      const wc = 1 - wa - wb;
      if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) continue;
      const [lateral, down, facing, head] = [0, 1, 2, 3].map((k) => wa * a.drawing[k] + wb * b.drawing[k] + wc * c.drawing[k]);
      const { label, relief } = head >= 0.5 ? { label: 0, relief: 1 } : sampleMap(bodyMap, ...drawingPixel(lateral, down, facing));
      const texel = y * MAP_SIZE + x;
      mapRgb[texel * 3] = Math.round(relief * 255);
      mapRgb[texel * 3 + 1] = label > 0 ? (label - 1) * 2 + (lateral >= 0 ? 0 : 1) + 1 : 0;
      covered[texel] = 1;
    }
  }
}
// Bleeds each island's edge outward, so filtering across a texture seam never reads the empty space between islands.
for (let pass = 0; pass < 6; pass++) {
  const grown = covered.slice();
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const texel = y * MAP_SIZE + x;
      if (covered[texel]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE || !covered[ny * MAP_SIZE + nx]) continue;
        mapRgb.copyWithin(texel * 3, (ny * MAP_SIZE + nx) * 3, (ny * MAP_SIZE + nx) * 3 + 3);
        grown[texel] = 1;
        break;
      }
    }
  }
  covered.set(grown);
}
await Bun.write(join(import.meta.dir, "../viewer/assets/muscle-map.png"), encodePng(mapRgb, MAP_SIZE, MAP_SIZE));

const asset: LifterAsset = {
  source: `MakeHuman ${MAKEHUMAN_COMMIT} (CC0)`,
  bind: body.joints.map((joint) => ({
    position: bind[joint.index].toArray() as [number, number, number],
    rotation: segments[joint.index].rotation.toArray() as [number, number, number, number],
  })),
  fingers,
  positions: bindPositions,
  normals,
  centers: rotationCenter,
  uvs,
  indices: Uint16Array.from(indices),
  skinIndex,
  skinWeight,
};
await Bun.write(OUT, encodeLifter(asset));
console.log(`${OUT}: ${count} vertices, ${indices.length / 3} triangles`);
for (const name of ["shoulder", "elbow", "hip", "knee"]) {
  console.log(`${name} segment stretch ${segments[body.index[`${name}_L`]].stretch.toFixed(2)}`);
}
