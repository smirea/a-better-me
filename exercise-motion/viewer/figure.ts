import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  Vector4,
} from "three";
import { SIDES, type Body, type Frame } from "../src/body";
import { MUSCLES } from "../src/muscles";
import { createAnatomyAtlas } from "./anatomy";
import { createFigureGeometry } from "./figure-mesh";

const BODY = new Color("#2e2e2e");
const PLATE = new Color("#4a4a4a");

export class Figure {
  readonly group = new Group();
  private readonly mesh;
  private readonly bind: Vector3[];
  private readonly shoulders: { joint: number; clavicle: number }[];
  private readonly rotations: Quaternion[];
  private readonly relativeRotation = new Quaternion();
  private readonly twist = new Quaternion();
  private readonly translation = new Vector3();
  private readonly dual: Vector4[];
  private readonly grip = { value: 0 };
  private readonly colors = [
    BODY,
    ...Array.from({ length: MUSCLES.length * 2 }, () => PLATE.clone()),
  ];

  constructor(body: Body) {
    this.bind = [];
    for (const joint of body.joints) {
      this.bind.push(
        joint.parent < 0 ? new Vector3() : this.bind[joint.parent].clone().add(joint.offset),
      );
    }
    this.shoulders = SIDES.map((side) => ({
      joint: body.index[`shoulder_${side}`],
      clavicle: body.index[`clavicle_${side}`],
    }));
    const jointCount = body.joints.length + this.shoulders.length;
    this.rotations = Array.from({ length: jointCount }, () => new Quaternion());
    this.dual = Array.from({ length: jointCount }, () => new Vector4(0, 0, 0, 0));
    const atlas = createAnatomyAtlas();
    const material = new MeshStandardMaterial({
      bumpMap: atlas,
      bumpScale: 0.008,
      roughness: 0.77,
    });

    // Blending rigid transforms as dual quaternions retains joint volume at deep flexion and forearm twist.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.jointRotation = { value: this.rotations };
      shader.uniforms.jointDual = { value: this.dual };
      shader.uniforms.pressGrip = this.grip;
      shader.uniforms.musclePalette = { value: this.colors };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
					attribute vec3 jointIndices;
					attribute vec2 jointWeights;
					attribute float gripShift;
					uniform vec4 jointRotation[${jointCount}];
					uniform vec4 jointDual[${jointCount}];
					uniform float pressGrip;
					vec3 rotateSkin(vec4 q, vec3 v) {
						return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
					}
				`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `
					int primaryJoint = int(jointIndices.x);
					int secondaryJoint = int(jointIndices.y);
					vec4 a = jointRotation[primaryJoint];
					vec4 b = jointRotation[secondaryJoint];
					float hemisphere = dot(a, b) < 0.0 ? -1.0 : 1.0;
					vec4 real = mix(a, hemisphere * b, jointWeights.x);
					vec4 dual = mix(jointDual[primaryJoint], hemisphere * jointDual[secondaryJoint], jointWeights.x);
					if (jointWeights.y > 0.0) {
						int shoulderJoint = int(jointIndices.z);
						vec4 shoulder = jointRotation[shoulderJoint];
						float shoulderHemisphere = dot(real, shoulder) < 0.0 ? -1.0 : 1.0;
						real = mix(real, shoulderHemisphere * shoulder, jointWeights.y);
						dual = mix(dual, shoulderHemisphere * jointDual[shoulderJoint], jointWeights.y);
					}
					float invLen = inversesqrt(dot(real, real));
					vec4 rotation = real * invLen;
					dual *= invLen;
					vec3 translation = 2.0 * (rotation.w * dual.xyz - dual.w * rotation.xyz + cross(rotation.xyz, dual.xyz));
					vec3 objectNormal = rotateSkin(rotation, normal);
				`,
        )
        .replace(
          "#include <begin_vertex>",
          `
					vec3 localPosition = position + vec3(0.0, pressGrip * gripShift, 0.0);
					vec3 transformed = rotateSkin(rotation, localPosition) + translation;
				`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
					uniform vec3 musclePalette[${this.colors.length}];
				`,
        )
        .replace(
          "#include <color_fragment>",
          `
					ivec2 pixel = ivec2(vBumpMapUv * vec2(textureSize(bumpMap, 0)));
					int plate = int(round(texelFetch(bumpMap, pixel, 0).b * 255.0));
					float coverage = texture2D(bumpMap, vBumpMapUv).g;
					diffuseColor.rgb *= mix(musclePalette[0], musclePalette[plate], coverage);
				`,
        );
    };

    this.mesh = new Mesh(createFigureGeometry(body), material);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  setPressGrip(enabled: boolean) {
    this.grip.value = Number(enabled);
  }

  pose(frame: Frame) {
    for (let i = 0; i < this.bind.length; i++) {
      const q = this.rotations[i].copy(frame.rot[i]);
      this.setDual(i, frame.pos[i], this.bind[i], q);
    }
    // The deltoid follows the arm's swing. Axial twist blends in below the cap to keep the armpit from winding up.
    this.shoulders.forEach(({ joint, clavicle }, side) => {
      const index = this.bind.length + side;
      const local = this.relativeRotation
        .copy(frame.rot[clavicle])
        .invert()
        .multiply(frame.rot[joint]);
      const inverseTwist = this.twist.set(0, -local.y, 0, local.w).normalize();
      const q = this.rotations[index].copy(frame.rot[joint]).multiply(inverseTwist);
      this.setDual(index, frame.pos[joint], this.bind[joint], q);
    });
  }

  private setDual(index: number, position: Vector3, bind: Vector3, q: Quaternion) {
    const t = this.translation.copy(bind).applyQuaternion(q).negate().add(position);
    this.dual[index].set(
      (t.x * q.w + t.y * q.z - t.z * q.y) * 0.5,
      (t.y * q.w + t.z * q.x - t.x * q.z) * 0.5,
      (t.z * q.w + t.x * q.y - t.y * q.x) * 0.5,
      -(t.x * q.x + t.y * q.y + t.z * q.z) * 0.5,
    );
  }

  bounds() {
    const box = new Box3();
    const { position, jointIndices, jointWeights, gripShift } = this.mesh.geometry.attributes;
    const p = new Vector3();
    const translation = new Vector3();
    const imaginary = new Vector3();
    const dualVector = new Vector3();
    const dual = new Vector4();
    const q = new Quaternion();
    for (let i = 0; i < position.count; i++) {
      const a = jointIndices.getX(i);
      const b = jointIndices.getY(i);
      const t = jointWeights.getX(i);
      const first = this.rotations[a];
      const second = this.rotations[b];
      const mix = first.dot(second) < 0 ? -t : t;
      q.set(
        first.x * (1 - t) + second.x * mix,
        first.y * (1 - t) + second.y * mix,
        first.z * (1 - t) + second.z * mix,
        first.w * (1 - t) + second.w * mix,
      );
      dual
        .copy(this.dual[a])
        .multiplyScalar(1 - t)
        .addScaledVector(this.dual[b], mix);
      const shoulderWeight = jointWeights.getY(i);
      if (shoulderWeight > 0) {
        const joint = jointIndices.getZ(i);
        const shoulder = this.rotations[joint];
        const weight = q.dot(shoulder) < 0 ? -shoulderWeight : shoulderWeight;
        const base = 1 - shoulderWeight;
        q.set(
          base * q.x + weight * shoulder.x,
          base * q.y + weight * shoulder.y,
          base * q.z + weight * shoulder.z,
          base * q.w + weight * shoulder.w,
        );
        dual.multiplyScalar(base).addScaledVector(this.dual[joint], weight);
      }
      const invLength = 1 / q.length();
      q.normalize();
      dual.multiplyScalar(invLength);
      imaginary.set(q.x, q.y, q.z);
      dualVector.set(dual.x, dual.y, dual.z);
      translation
        .crossVectors(imaginary, dualVector)
        .addScaledVector(dualVector, q.w)
        .addScaledVector(imaginary, -dual.w);
      p.fromBufferAttribute(position, i);
      p.y += this.grip.value * gripShift.getX(i);
      box.expandByPoint(p.applyQuaternion(q).addScaledVector(translation, 2));
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
