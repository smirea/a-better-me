import {
  Color,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { SIDES, sideSign, type Body, type Frame } from "../src/body";
import { MUSCLES, type Muscle } from "../src/muscles";

const BODY = new Color("#333336");
const PLATE = new Color("#5b5b60");

/** A muscle plate: an ellipsoid on a segment, given for the left side as centre and radii in the joint's frame. */
type Pad = [joint: string, center: [number, number, number], radii: [number, number, number]];

/**
 * Where each of the app's muscle groups sits on the figure. The plates follow the app's flat body map: dark
 * silhouette, grey plates, and a plate fills with colour as its muscle works.
 */
const PADS: Record<Muscle, Pad[]> = {
  chest: [["thoracic", [0.075, 0.2, 0.118], [0.07, 0.055, 0.03]]],
  upper_traps: [["thoracic", [0.06, 0.318, -0.015], [0.055, 0.03, 0.045]]],
  upper_back: [["thoracic", [0.06, 0.2, -0.07], [0.055, 0.07, 0.028]]],
  lats: [["thoracic", [0.118, 0.09, -0.05], [0.045, 0.1, 0.04]]],
  serratus: [["thoracic", [0.148, 0.11, 0.045], [0.022, 0.05, 0.045]]],
  neck: [["neck", [0.03, 0.045, 0.012], [0.024, 0.045, 0.032]]],
  abs: [["lumbar", [0.04, 0.085, 0.108], [0.038, 0.1, 0.022]]],
  obliques: [["lumbar", [0.128, 0.07, 0.05], [0.035, 0.08, 0.06]]],
  lower_back: [["lumbar", [0.045, 0.07, -0.072], [0.036, 0.1, 0.028]]],
  glutes: [["pelvis", [0.085, 0, -0.088], [0.075, 0.08, 0.05]]],
  hip_flexors: [["pelvis", [0.085, 0.005, 0.088], [0.036, 0.05, 0.022]]],
  abductors: [["pelvis", [0.168, 0.03, -0.01], [0.026, 0.06, 0.06]]],
  quads: [["hip", [0, -0.22, 0.042], [0.058, 0.17, 0.042]]],
  hamstrings: [["hip", [0, -0.23, -0.042], [0.052, 0.16, 0.038]]],
  adductors: [["hip", [-0.046, -0.15, 0], [0.03, 0.12, 0.046]]],
  calves: [["knee", [0, -0.14, -0.028], [0.045, 0.11, 0.036]]],
  tibs: [["knee", [0.012, -0.18, 0.03], [0.022, 0.13, 0.02]]],
  front_delts: [["shoulder", [0, -0.03, 0.04], [0.035, 0.06, 0.03]]],
  side_delts: [["shoulder", [0.04, -0.035, 0], [0.03, 0.065, 0.04]]],
  rear_delts: [["shoulder", [0, -0.03, -0.04], [0.035, 0.06, 0.03]]],
  biceps: [["shoulder", [0, -0.2, 0.03], [0.032, 0.09, 0.028]]],
  triceps: [["shoulder", [0, -0.19, -0.03], [0.036, 0.11, 0.028]]],
  forearms: [["elbow", [0, -0.1, 0], [0.043, 0.1, 0.041]]],
};

function capsule(length: number, ra: number, rb: number) {
  const profile: Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const angle = -Math.PI / 2 + (Math.PI / 2) * (i / steps);
    profile.push(new Vector2(ra * Math.cos(angle), ra * Math.sin(angle)));
  }
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI / 2) * (i / steps);
    profile.push(new Vector2(rb * Math.cos(angle), length + rb * Math.sin(angle)));
  }
  return new LatheGeometry(profile, 28);
}

const UP = new Vector3(0, 1, 0);

export class Figure {
  readonly group = new Group();
  private joints: Group[];
  private plates: MeshStandardMaterial[][] = MUSCLES.map(() => []);

  constructor(private body: Body) {
    this.joints = body.joints.map(() => {
      const group = new Group();
      this.group.add(group);
      return group;
    });
    const skin = new MeshStandardMaterial({ color: BODY, roughness: 0.82, metalness: 0.02 });
    const k = body.height / 1.78;
    for (const collider of body.colliders) {
      if (!collider.visible) continue;
      const axis = collider.b.clone().sub(collider.a);
      const mesh = new Mesh(capsule(axis.length(), collider.ra, collider.rb), skin);
      mesh.position.copy(collider.a);
      mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, axis.normalize()));
      if (collider.id === "head") mesh.scale.set(0.84, 1, 1);
      this.joints[collider.joint].add(mesh);
    }
    const ball = new SphereGeometry(1, 28, 20);
    MUSCLES.forEach((muscle, m) => {
      SIDES.forEach((side, n) => {
        const material = new MeshStandardMaterial({
          color: PLATE,
          roughness: 0.7,
          metalness: 0.02,
        });
        this.plates[m][n] = material;
        for (const [joint, center, radii] of PADS[muscle]) {
          const index = body.index[joint] ?? body.index[`${joint}_${side}`];
          const mesh = new Mesh(ball, material);
          mesh.position.set(center[0] * sideSign(side) * k, center[1] * k, center[2] * k);
          mesh.scale.set(radii[0] * k, radii[1] * k, radii[2] * k);
          this.joints[index].add(mesh);
        }
      });
    });
  }

  pose(frame: Frame) {
    this.joints.forEach((group, i) => {
      group.position.copy(frame.pos[i]);
      group.quaternion.copy(frame.rot[i]);
    });
  }

  /** `values` holds one number in [0, 1] per muscle and side, in `MUSCLES` order, left then right. */
  tint(values: ArrayLike<number>, color: Color) {
    MUSCLES.forEach((_, m) => {
      for (let n = 0; n < 2; n++) {
        const value = Math.min(1, values[m * 2 + n]);
        // Any work at all shows as a visible tint, as on the app's body map.
        this.plates[m][n].color.copy(PLATE).lerp(color, value < 0.03 ? 0 : 0.18 + 0.82 * value);
        this.plates[m][n].emissive.copy(color).multiplyScalar(value < 0.03 ? 0 : 0.25 * value);
      }
    });
  }
}
