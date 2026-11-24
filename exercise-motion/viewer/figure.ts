import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  Texture,
  Vector3,
  Vector4,
} from "three";
import type { Body, Frame } from "../src/body";
import { MUSCLES } from "../src/muscles";
import { decodeLifter, type LifterAsset } from "./lifter-asset";

const BODY = new Color("#2e2e2e");
const PLATE = new Color("#4a4a4a");

/**
 * How far each finger bone bends past its rest curl to wrap a bar, in degrees, by segment from the palm out. A press
 * grip carries the bar in the heel of the hand, so the fingers close a little less.
 */
const CURL = {
  hang: { thumb: [20, 35, 30], finger: [75, 80, 50] },
  press: { thumb: [25, 40, 35], finger: [85, 85, 50] },
  open: { thumb: [5, 8, 6], finger: [6, 8, 6] },
};

let preloadedAsset: LifterAsset | null = null;
let preloadedMuscleMapUrl: string | null = null;

export async function preloadFigureAssets(basePath = "."): Promise<void> {
  const inline = document.getElementById("lifter")?.textContent?.trim();
  if (inline && inline !== "__LIFTER__") {
    const bytes = Uint8Array.from(atob(inline), (c) => c.charCodeAt(0));
    preloadedAsset = decodeLifter(bytes.buffer);
    const mapText = document.getElementById("muscle-map")?.textContent?.trim();
    if (mapText && mapText !== "__MUSCLE_MAP__") {
      preloadedMuscleMapUrl = `data:image/png;base64,${mapText}`;
    }
    return;
  }
  const resp = await fetch(`${basePath}/lifter.bin`);
  if (!resp.ok) throw new Error(`Failed to fetch ${basePath}/lifter.bin (${resp.status})`);
  preloadedAsset = decodeLifter(await resp.arrayBuffer());
  preloadedMuscleMapUrl = `${basePath}/muscle-map.png`;
}

function readAsset(): LifterAsset {
  if (preloadedAsset) return preloadedAsset;
  const element = document.getElementById("lifter");
  if (!element?.textContent) throw new Error("The page has no lifter mesh");
  const bytes = Uint8Array.from(atob(element.textContent.trim()), (c) => c.charCodeAt(0));
  preloadedAsset = decodeLifter(bytes.buffer);
  return preloadedAsset;
}

interface Rest {
  position: Vector3;
  rotation: Quaternion;
}

export class Figure {
  readonly group = new Group();
  private readonly asset: LifterAsset;
  private readonly mesh: Mesh;
  private readonly bind: Rest[];
  private readonly fingerRest: Rest[];
  /** Each finger bone's parent: a rig joint index, or a finger bone's own index past the rig joints. */
  private readonly fingerParent: number[];
  private readonly posed: Rest[];
  /** Each joint's skin transform, posed times rest inverse: a rotation and the translation after it. */
  private readonly rotation: Vector4[];
  private readonly translation: Vector3[];
  private grip: keyof typeof CURL = "hang";
  private readonly colors = [BODY, ...Array.from({ length: MUSCLES.length * 2 }, () => PLATE.clone())];
  private readonly q = new Quaternion();
  private readonly t = new Vector3();
  private readonly curl = new Quaternion();
  private readonly axis = new Vector3(1, 0, 0);

  constructor(private readonly body: Body) {
    this.asset = readAsset();
    const jointCount = body.joints.length + this.asset.fingers.length;
    const rest = (position: number[], rotation: number[]) => ({
      position: new Vector3(...position),
      rotation: new Quaternion(...rotation),
    });
    this.bind = this.asset.bind.map((frame) => rest(frame.position, frame.rotation));
    this.fingerRest = this.asset.fingers.map((bone) => rest(bone.position, bone.rotation));
    this.fingerParent = this.asset.fingers.map((bone) => {
      const rig = body.index[bone.parent];
      return rig ?? body.joints.length + this.asset.fingers.findIndex((other) => other.name === bone.parent);
    });
    this.posed = Array.from({ length: jointCount }, () => ({ position: new Vector3(), rotation: new Quaternion() }));
    this.rotation = Array.from({ length: jointCount }, () => new Vector4(0, 0, 0, 1));
    this.translation = Array.from({ length: jointCount }, () => new Vector3());

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.asset.positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(this.asset.normals, 3));
    geometry.setAttribute("uv", new BufferAttribute(this.asset.uvs, 2));
    geometry.setAttribute("rotationCenter", new BufferAttribute(this.asset.centers, 3));
    geometry.setAttribute("jointIndex", new BufferAttribute(this.asset.skinIndex, 4));
    geometry.setAttribute("jointWeight", new BufferAttribute(this.asset.skinWeight, 4, true));
    geometry.setIndex(new BufferAttribute(this.asset.indices, 1));

    // Red is each texel's relief, which also lights the grooves as bump; green names its plate, read exactly.
    const map = new Texture();
    map.flipY = true;
    map.generateMipmaps = false;
    map.magFilter = NearestFilter;
    const relief = new Texture();
    relief.flipY = true;
    const image = new Image();
    image.onload = () => {
      map.image = image;
      relief.image = image;
      map.needsUpdate = true;
      relief.needsUpdate = true;
    };
    image.src =
      preloadedMuscleMapUrl ??
      `data:image/png;base64,${document.getElementById("muscle-map")?.textContent?.trim()}`;
    const material = new MeshStandardMaterial({ bumpMap: relief, bumpScale: 1.6, roughness: 0.66, metalness: 0.02 });
    // Each vertex turns by the blend of its joints' rotations about its own centre of rotation, which the joints carry
    // as linear blending would. That keeps volume at a deep bend without the bulge dual quaternions leave.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.jointRotation = { value: this.rotation };
      shader.uniforms.jointTranslation = { value: this.translation };
      shader.uniforms.muscleMap = { value: map };
      shader.uniforms.musclePalette = { value: this.colors };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform sampler2D muscleMap;
          uniform vec3 musclePalette[${this.colors.length}];`,
        )
        .replace(
          "#include <color_fragment>",
          `ivec2 texel = ivec2(vBumpMapUv * vec2(textureSize(muscleMap, 0)));
          int plate = int(round(texelFetch(muscleMap, texel, 0).g * 255.0));
          float rise = smoothstep(0.12, 0.55, texture2D(bumpMap, vBumpMapUv).r);
          diffuseColor.rgb = mix(musclePalette[0], musclePalette[plate], plate > 0 ? rise : 0.0);`,
        );
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute vec4 jointIndex;
          attribute vec4 jointWeight;
          attribute vec3 rotationCenter;
          uniform vec4 jointRotation[${jointCount}];
          uniform vec3 jointTranslation[${jointCount}];
          vec3 rotateSkin(vec4 q, vec3 v) {
            return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
          }`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `vec4 pivot = jointRotation[int(jointIndex.x)];
          vec4 blended = vec4(0.0);
          vec3 carried = vec3(0.0);
          for (int k = 0; k < 4; k++) {
            float w = jointWeight[k];
            if (w == 0.0) continue;
            int j = int(jointIndex[k]);
            vec4 r = jointRotation[j];
            blended += (dot(pivot, r) < 0.0 ? -w : w) * r;
            carried += w * (rotateSkin(r, rotationCenter) + jointTranslation[j]);
          }
          vec4 rotation = normalize(blended);
          vec3 translation = carried - rotateSkin(rotation, rotationCenter);
          vec3 objectNormal = rotateSkin(rotation, normal);`,
        )
        .replace("#include <begin_vertex>", "vec3 transformed = rotateSkin(rotation, position) + translation;");
    };

    this.mesh = new Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  setGrip(grip: keyof typeof CURL) {
    this.grip = grip;
  }

  setPressGrip(enabled: boolean) {
    this.grip = enabled ? "press" : "hang";
  }

  pose(frame: Frame) {
    const rig = this.body.joints.length;
    for (let j = 0; j < rig; j++) {
      this.posed[j].position.copy(frame.pos[j]);
      this.posed[j].rotation.copy(frame.rot[j]);
      this.setSkin(j, this.bind[j]);
    }
    const curls = CURL[this.grip];
    this.asset.fingers.forEach((bone, f) => {
      const parent = this.fingerParent[f];
      const parentRest = parent < rig ? this.bind[parent] : this.fingerRest[parent - rig];
      const parentPosed = this.posed[parent];
      const rest = this.fingerRest[f];
      const posed = this.posed[rig + f];
      const local = this.q.copy(parentRest.rotation).invert();
      this.t.copy(rest.position).sub(parentRest.position).applyQuaternion(local);
      posed.position.copy(this.t).applyQuaternion(parentPosed.rotation).add(parentPosed.position);
      const angle = (bone.finger === 1 ? curls.thumb : curls.finger)[bone.segment - 1];
      this.curl.setFromAxisAngle(this.axis, (angle * Math.PI) / 180);
      posed.rotation.copy(parentPosed.rotation).multiply(local.multiply(rest.rotation)).multiply(this.curl);
      this.setSkin(rig + f, rest);
    });
  }

  /** The skin transform posed * rest⁻¹. */
  private setSkin(index: number, rest: Rest) {
    const posed = this.posed[index];
    const q = this.q.copy(rest.rotation).invert().premultiply(posed.rotation);
    this.rotation[index].set(q.x, q.y, q.z, q.w);
    this.translation[index].copy(rest.position).applyQuaternion(q).negate().add(posed.position);
  }

  bounds() {
    const box = new Box3();
    const { positions, centers, skinIndex, skinWeight } = this.asset;
    const blended = new Vector4();
    const carried = new Vector3();
    const center = new Vector3();
    const joint = new Quaternion();
    const q = new Quaternion();
    const p = new Vector3();
    const term = new Vector3();
    for (let i = 0; i < positions.length / 3; i++) {
      const pivot = this.rotation[skinIndex[i * 4]];
      blended.set(0, 0, 0, 0);
      carried.set(0, 0, 0);
      center.fromArray(centers, i * 3);
      for (let k = 0; k < 4; k++) {
        const w = skinWeight[i * 4 + k] / 255;
        if (w === 0) continue;
        const r = this.rotation[skinIndex[i * 4 + k]];
        blended.addScaledVector(r, pivot.dot(r) < 0 ? -w : w);
        joint.set(r.x, r.y, r.z, r.w);
        carried.addScaledVector(term.copy(center).applyQuaternion(joint).add(this.translation[skinIndex[i * 4 + k]]), w);
      }
      q.set(blended.x, blended.y, blended.z, blended.w).normalize();
      p.fromArray(positions, i * 3).sub(center).applyQuaternion(q).add(carried);
      box.expandByPoint(p);
    }
    return box;
  }

  tint(values: ArrayLike<number>, color: Color) {
    for (let i = 0; i < this.colors.length - 1; i++) {
      const value = Math.min(1, values[i]);
      this.colors[i + 1].copy(PLATE).lerp(color, value < 0.03 ? 0 : 0.2 + 0.8 * value);
    }
  }
}
