import { Euler, Quaternion, Vector3 } from "three";
import { clamp, quatFromRotVec, rad, rotVecFromQuat, type Vec3 } from "./math";

export type Side = "L" | "R";
export const SIDES: Side[] = ["L", "R"];
/** +1 on the figure's left, which is +X: the figure stands on the floor (Y up) and faces +Z. */
export const sideSign = (side: Side) => (side === "L" ? 1 : -1);
export const otherSide = (side: Side): Side => (side === "L" ? "R" : "L");

type JointKind = "root" | "ball" | "hinge" | "universal";

interface DofDef {
  name: string;
  axis: Vec3;
  /** Multiplies the anatomical angle, so a positive value always means the named motion on both sides. */
  sign: number;
  limit: [number, number];
}

export interface Joint {
  name: string;
  index: number;
  parent: number;
  offset: Vector3;
  kind: JointKind;
  dofs: DofDef[];
  dofStart: number;
  side: Side | null;
}

export interface MassSegment {
  name: string;
  joint: number;
  com: Vector3;
  mass: number;
}

export interface Collider {
  id: string;
  joint: number;
  a: Vector3;
  b: Vector3;
  ra: number;
  rb: number;
  /** False for a collision-only stand-in, such as the part of the thigh that can reach the belly. */
  visible: boolean;
}

export interface Anchor {
  joint: number;
  local: Vector3;
}

export interface Body {
  height: number;
  mass: number;
  joints: Joint[];
  index: Record<string, number>;
  dofCount: number;
  segments: MassSegment[];
  colliders: Collider[];
  colliderIndex: Record<string, number>;
  anchors: Record<string, Anchor>;
  lengths: {
    thigh: number;
    shank: number;
    upperArm: number;
    forearm: number;
    ankleHeight: number;
    hipHeight: number;
  };
}

export interface Frame {
  pos: Vector3[];
  rot: Quaternion[];
}

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];
const limit = (lo: number, hi: number): [number, number] => [rad(lo), rad(hi)];

/**
 * Anatomical ranges of motion in degrees for the ball joints, read through `angles`. Hinge and universal joints
 * carry theirs on the degree of freedom. Shoulder elevation is limited per plane by `shoulderElevationLimit`.
 */
export const BALL_LIMITS: Record<string, [number, number]> = {
  "hip.flex": [-20, 125],
  "hip.abd": [-25, 45],
  "hip.rot": [-35, 45],
  "lumbar.flex": [-25, 50],
  "lumbar.bend": [-25, 25],
  "lumbar.twist": [-10, 10],
  "thoracic.flex": [-20, 35],
  "thoracic.bend": [-25, 25],
  "thoracic.twist": [-35, 35],
  "neck.flex": [-60, 50],
  "neck.bend": [-40, 40],
  "neck.twist": [-75, 75],
  "shoulder.twist": [-100, 100],
};

const ELEVATION_BY_PLANE: [number, number][] = [
  [-180, 30],
  [-135, 45],
  [-90, 60],
  [-45, 115],
  [0, 180],
  [90, 180],
  [135, 140],
  [180, 30],
];

/** The farthest the upper arm lifts away from hanging, by direction: 0 is out to the side, 90 straight ahead, -90 straight behind. */
export function shoulderElevationLimit(planeDegrees: number) {
  for (let i = 1; i < ELEVATION_BY_PLANE.length; i++) {
    const [p0, e0] = ELEVATION_BY_PLANE[i - 1];
    const [p1, e1] = ELEVATION_BY_PLANE[i];
    if (planeDegrees <= p1) return e0 + ((e1 - e0) * (planeDegrees - p0)) / (p1 - p0);
  }
  return 30;
}

export function createBody(height = 1.78, mass = 80): Body {
  const k = height / 1.78;
  const joints: Joint[] = [];
  const index: Record<string, number> = {};
  let dofCount = 0;
  const add = (
    name: string,
    parent: string | null,
    offset: Vec3,
    kind: JointKind,
    dofs: DofDef[] = [],
  ) => {
    const joint: Joint = {
      name,
      index: joints.length,
      parent: parent === null ? -1 : index[parent],
      offset: new Vector3(offset[0] * k, offset[1] * k, offset[2] * k),
      kind,
      dofs,
      dofStart: dofCount,
      side: name.endsWith("_L") ? "L" : name.endsWith("_R") ? "R" : null,
    };
    index[name] = joint.index;
    joints.push(joint);
    dofCount += kind === "root" ? 6 : kind === "ball" ? 3 : dofs.length;
  };

  add("pelvis", null, [0, 0, 0], "root");
  add("lumbar", "pelvis", [0, 0.09, -0.02], "ball");
  add("thoracic", "lumbar", [0, 0.14, 0], "ball");
  add("neck", "thoracic", [0, 0.33, 0], "ball");
  for (const side of SIDES) {
    const s = sideSign(side);
    add(`clavicle_${side}`, "thoracic", [s * 0.025, 0.285, 0.04], "universal", [
      { name: "prot", axis: Y, sign: -s, limit: limit(-28, 25) },
      { name: "elev", axis: Z, sign: s, limit: limit(-10, 35) },
    ]);
    add(`shoulder_${side}`, `clavicle_${side}`, [s * 0.165, 0, -0.03], "ball");
    add(`elbow_${side}`, `shoulder_${side}`, [0, -0.331, 0], "hinge", [
      { name: "flex", axis: X, sign: -1, limit: limit(0, 150) },
    ]);
    add(`forearm_${side}`, `elbow_${side}`, [0, 0, 0], "hinge", [
      { name: "pron", axis: Y, sign: -s, limit: limit(-85, 85) },
    ]);
    add(`wrist_${side}`, `forearm_${side}`, [0, -0.26, 0], "universal", [
      { name: "flex", axis: Z, sign: -s, limit: limit(-70, 80) },
      { name: "dev", axis: X, sign: -1, limit: limit(-30, 20) },
    ]);
  }
  for (const side of SIDES) {
    const s = sideSign(side);
    add(`hip_${side}`, "pelvis", [s * 0.088, 0, 0], "ball");
    add(`knee_${side}`, `hip_${side}`, [0, -0.436, 0], "hinge", [
      { name: "flex", axis: X, sign: 1, limit: limit(0, 150) },
    ]);
    add(`ankle_${side}`, `knee_${side}`, [0, -0.438, 0], "universal", [
      { name: "dorsi", axis: X, sign: -1, limit: limit(-45, 35) },
      { name: "inv", axis: Z, sign: -s, limit: limit(-20, 30) },
    ]);
  }

  // Winter's segment mass fractions and centre-of-mass positions, with the trunk split into three.
  const segments: MassSegment[] = [];
  const seg = (name: string, joint: string, com: Vec3, fraction: number) =>
    segments.push({
      name,
      joint: index[joint],
      com: new Vector3(com[0] * k, com[1] * k, com[2] * k),
      mass: fraction * mass,
    });
  seg("pelvis", "pelvis", [0, 0.03, -0.01], 0.142);
  seg("abdomen", "lumbar", [0, 0.07, 0.01], 0.139);
  seg("thorax", "thoracic", [0, 0.16, 0.02], 0.216);
  seg("head", "neck", [0, 0.13, 0.02], 0.081);
  for (const side of SIDES) {
    seg(`upperarm_${side}`, `shoulder_${side}`, [0, -0.331 * 0.436, 0], 0.028);
    seg(`forearm_${side}`, `elbow_${side}`, [0, -0.26 * 0.43, 0], 0.016);
    seg(`hand_${side}`, `wrist_${side}`, [0, -0.07, 0], 0.006);
    seg(`thigh_${side}`, `hip_${side}`, [0, -0.436 * 0.433, 0], 0.1);
    seg(`shank_${side}`, `knee_${side}`, [0, -0.438 * 0.433, 0], 0.0465);
    seg(`foot_${side}`, `ankle_${side}`, [0, -0.04, 0.06], 0.0145);
  }

  const colliders: Collider[] = [];
  const colliderIndex: Record<string, number> = {};
  const cap = (
    id: string,
    joint: string,
    a: Vec3,
    b: Vec3,
    ra: number,
    rb = ra,
    visible = true,
  ) => {
    colliderIndex[id] = colliders.length;
    colliders.push({
      id,
      joint: index[joint],
      a: new Vector3(a[0] * k, a[1] * k, a[2] * k),
      b: new Vector3(b[0] * k, b[1] * k, b[2] * k),
      ra: ra * k,
      rb: rb * k,
      visible,
    });
  };
  cap("pelvis", "pelvis", [-0.065, 0.02, -0.01], [0.065, 0.02, -0.01], 0.102);
  cap("abdomen", "lumbar", [-0.055, 0.07, 0.02], [0.055, 0.07, 0.02], 0.1);
  cap("chest", "thoracic", [-0.065, 0.14, 0.03], [0.065, 0.14, 0.03], 0.115);
  cap("girdle", "thoracic", [-0.115, 0.27, 0.02], [0.115, 0.27, 0.02], 0.08);
  cap("neck", "neck", [0, 0, 0], [0, 0.09, 0.015], 0.05);
  cap("head", "neck", [0, 0.15, 0.02], [0, 0.185, 0.02], 0.095);
  for (const side of SIDES) {
    const s = sideSign(side);
    cap(`upperarm_${side}`, `shoulder_${side}`, [0, 0, 0], [0, -0.331, 0], 0.052, 0.04);
    cap(`forearm_${side}`, `elbow_${side}`, [0, 0, 0], [0, -0.26, 0], 0.042, 0.028);
    cap(`hand_${side}`, `wrist_${side}`, [-s * 0.012, -0.03, 0], [-s * 0.012, -0.09, 0], 0.036);
    cap(`thigh_${side}`, `hip_${side}`, [0, 0, 0], [0, -0.436, 0], 0.085, 0.058);
    cap(`thighShaft_${side}`, `hip_${side}`, [0, -0.16, 0], [0, -0.436, 0], 0.075, 0.058, false);
    cap(`shank_${side}`, `knee_${side}`, [0, 0, 0], [0, -0.438, 0], 0.056, 0.038);
    cap(`foot_${side}`, `ankle_${side}`, [0, -0.034, -0.02], [0, -0.042, 0.17], 0.035, 0.027);
  }

  const anchors: Record<string, Anchor> = {};
  const anchor = (name: string, joint: string, local: Vec3) => {
    anchors[name] = {
      joint: index[joint],
      local: new Vector3(local[0] * k, local[1] * k, local[2] * k),
    };
  };
  anchor("traps", "thoracic", [0, 0.3, -0.068]);
  anchor("upperBack", "thoracic", [0, 0.21, -0.085]);
  anchor("sternum", "thoracic", [0, 0.12, 0.143]);
  anchor("sacrum", "pelvis", [0, 0.02, -0.115]);
  anchor("occiput", "neck", [0, 0.165, -0.075]);
  anchor("mouth", "neck", [0, 0.115, 0.105]);
  for (const side of SIDES) {
    const s = sideSign(side);
    // The palm faces the thigh in the neutral pose, so its normal points toward the midline.
    anchor(`grip_${side}`, `wrist_${side}`, [-s * 0.022, -0.085, 0]);
    anchor(`press_${side}`, `wrist_${side}`, [-s * 0.022, -0.045, 0]);
    anchor(`heel_${side}`, `ankle_${side}`, [0, -0.069, -0.05]);
    anchor(`ballIn_${side}`, `ankle_${side}`, [-s * 0.04, -0.069, 0.13]);
    anchor(`ballOut_${side}`, `ankle_${side}`, [s * 0.045, -0.069, 0.12]);
    anchor(`toe_${side}`, `ankle_${side}`, [0, -0.069, 0.2]);
    anchor(`secondToe_${side}`, `ankle_${side}`, [-s * 0.012, -0.069, 0.2]);
  }

  return {
    height,
    mass,
    joints,
    index,
    dofCount,
    segments,
    colliders,
    colliderIndex,
    anchors,
    lengths: {
      thigh: 0.436 * k,
      shank: 0.438 * k,
      upperArm: 0.331 * k,
      forearm: 0.26 * k,
      ankleHeight: 0.069 * k,
      hipHeight: 0.943 * k,
    },
  };
}

export const newFrame = (body: Body): Frame => ({
  pos: body.joints.map(() => new Vector3()),
  rot: body.joints.map(() => new Quaternion()),
});

const axisVec = new Vector3();
const local = new Quaternion();
const second = new Quaternion();

function localRotation(joint: Joint, q: ArrayLike<number>, out: Quaternion) {
  const i = joint.dofStart;
  if (joint.kind === "root") return quatFromRotVec(q[i + 3], q[i + 4], q[i + 5], out);
  if (joint.kind === "ball") return quatFromRotVec(q[i], q[i + 1], q[i + 2], out);
  const first = joint.dofs[0];
  out.setFromAxisAngle(axisVec.set(first.axis[0], first.axis[1], first.axis[2]), first.sign * q[i]);
  if (joint.dofs.length > 1) {
    const next = joint.dofs[1];
    second.setFromAxisAngle(
      axisVec.set(next.axis[0], next.axis[1], next.axis[2]),
      next.sign * q[i + 1],
    );
    out.multiply(second);
  }
  return out;
}

export function fk(body: Body, q: ArrayLike<number>, out = newFrame(body)): Frame {
  for (const joint of body.joints) {
    localRotation(joint, q, local);
    if (joint.parent < 0) {
      out.pos[0].set(q[0], q[1], q[2]);
      out.rot[0].copy(local);
      continue;
    }
    const parentRot = out.rot[joint.parent];
    out.pos[joint.index].copy(joint.offset).applyQuaternion(parentRot).add(out.pos[joint.parent]);
    out.rot[joint.index].multiplyQuaternions(parentRot, local);
  }
  return out;
}

export const worldPoint = (frame: Frame, joint: number, localPoint: Vector3, out = new Vector3()) =>
  out.copy(localPoint).applyQuaternion(frame.rot[joint]).add(frame.pos[joint]);

export const anchorPoint = (body: Body, frame: Frame, name: string, out = new Vector3()) => {
  const anchor = body.anchors[name];
  if (!anchor) throw new Error(`Unknown anchor ${name}`);
  return worldPoint(frame, anchor.joint, anchor.local, out);
};

export function centerOfMass(body: Body, frame: Frame, out = new Vector3()) {
  const p = new Vector3();
  out.set(0, 0, 0);
  for (const segment of body.segments)
    out.addScaledVector(worldPoint(frame, segment.joint, segment.com, p), segment.mass);
  return out.divideScalar(body.mass);
}

const euler = new Euler();
const qa = new Quaternion();
const qb = new Quaternion();
const swing = new Quaternion();
const dir = new Vector3();
const DOWN = new Vector3(0, -1, 0);

export type Angles = Record<string, number>;

/**
 * Every joint as named anatomical angles in radians, keyed `joint.motion` (`hip_L.flex`, `shoulder_R.elev`).
 * Positive is the named motion on both sides: flexion, abduction, external hip rotation, internal shoulder
 * twist, pronation, dorsiflexion, a left bend or left twist of the spine.
 */
export function angles(body: Body, q: ArrayLike<number>, out: Angles = {}): Angles {
  for (const joint of body.joints) {
    const i = joint.dofStart;
    if (joint.kind === "hinge" || joint.kind === "universal") {
      joint.dofs.forEach((dof, n) => (out[`${joint.name}.${dof.name}`] = q[i + n]));
      continue;
    }
    if (joint.kind === "root") continue;
    quatFromRotVec(q[i], q[i + 1], q[i + 2], qa);
    if (joint.name.startsWith("shoulder")) {
      const s = sideSign(joint.side!);
      // Read against the thorax, not the moving collarbone, so shrugging doesn't change the arm's reading.
      localRotation(body.joints[joint.parent], q, qb);
      qb.multiply(qa);
      dir.copy(DOWN).applyQuaternion(qb);
      const lateral = s * dir.x;
      out[`${joint.name}.elev`] = Math.acos(clamp(-dir.y, -1, 1));
      out[`${joint.name}.plane`] = Math.atan2(dir.z, lateral);
      out[`${joint.name}.flex`] = Math.atan2(dir.z, -dir.y);
      out[`${joint.name}.abd`] = Math.atan2(lateral, -dir.y);
      swing.setFromUnitVectors(DOWN, dir).invert().multiply(qb);
      let twist = 2 * Math.atan2(swing.y, swing.w);
      if (twist > Math.PI) twist -= 2 * Math.PI;
      if (twist < -Math.PI) twist += 2 * Math.PI;
      out[`${joint.name}.twist`] = -s * twist;
      continue;
    }
    euler.setFromQuaternion(qa, "XZY");
    if (joint.name.startsWith("hip")) {
      const s = sideSign(joint.side!);
      out[`${joint.name}.flex`] = -euler.x;
      out[`${joint.name}.abd`] = s * euler.z;
      out[`${joint.name}.rot`] = s * euler.y;
    } else {
      out[`${joint.name}.flex`] = euler.x;
      out[`${joint.name}.bend`] = -euler.z;
      out[`${joint.name}.twist`] = euler.y;
    }
  }
  return out;
}

export type PoseHints = Record<string, number>;

const hint = (hints: PoseHints, joint: Joint, motion: string) => {
  const exact = hints[`${joint.name}.${motion}`];
  if (exact !== undefined) return rad(exact);
  const base = joint.side ? joint.name.slice(0, -2) : joint.name;
  return rad(hints[`${base}.${motion}`] ?? 0);
};

/**
 * A full pose from anatomical angles in degrees. A key without a side (`hip.flex`) applies to both sides. The root
 * takes `root.x`, `root.y`, `root.z` in metres and `root.pitch` in degrees, positive leaning forward.
 */
export function makePose(body: Body, hints: PoseHints = {}): Float64Array {
  const q = new Float64Array(body.dofCount);
  const clavicle: Partial<Record<Side, Quaternion>> = {};
  for (const joint of body.joints) {
    const i = joint.dofStart;
    if (joint.kind === "root") {
      q[0] = hints["root.x"] ?? 0;
      q[1] = hints["root.y"] ?? body.lengths.hipHeight;
      q[2] = hints["root.z"] ?? 0;
      q[3] = rad(hints["root.pitch"] ?? 0);
      continue;
    }
    if (joint.kind === "hinge" || joint.kind === "universal") {
      joint.dofs.forEach((dof, n) => (q[i + n] = hint(hints, joint, dof.name)));
      if (joint.name.startsWith("clavicle"))
        clavicle[joint.side!] = localRotation(joint, q, new Quaternion());
      continue;
    }
    const rotation = new Quaternion();
    if (joint.name.startsWith("shoulder")) {
      const s = sideSign(joint.side!);
      const elev = hint(hints, joint, "elev");
      const plane = hint(hints, joint, "plane");
      dir.set(
        s * Math.sin(elev) * Math.cos(plane),
        -Math.cos(elev),
        Math.sin(elev) * Math.sin(plane),
      );
      rotation.setFromUnitVectors(DOWN, dir);
      rotation.multiply(
        qa.setFromAxisAngle(axisVec.set(0, 1, 0), -s * hint(hints, joint, "twist")),
      );
      rotation.premultiply(qb.copy(clavicle[joint.side!]!).invert());
    } else if (joint.name.startsWith("hip")) {
      const s = sideSign(joint.side!);
      euler.set(
        -hint(hints, joint, "flex"),
        s * hint(hints, joint, "rot"),
        s * hint(hints, joint, "abd"),
        "XZY",
      );
      rotation.setFromEuler(euler);
    } else {
      euler.set(
        hint(hints, joint, "flex"),
        hint(hints, joint, "twist"),
        -hint(hints, joint, "bend"),
        "XZY",
      );
      rotation.setFromEuler(euler);
    }
    const v = rotVecFromQuat(rotation);
    q[i] = v[0];
    q[i + 1] = v[1];
    q[i + 2] = v[2];
  }
  return q;
}

export function interpolatePose(
  body: Body,
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  t: number,
  out: Float64Array,
) {
  for (let i = body.dofCount; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  for (const joint of body.joints) {
    const i = joint.dofStart;
    if (joint.kind === "hinge" || joint.kind === "universal") {
      for (let n = 0; n < joint.dofs.length; n++) out[i + n] = a[i + n] + (b[i + n] - a[i + n]) * t;
      continue;
    }
    const r = joint.kind === "root" ? i + 3 : i;
    if (joint.kind === "root") for (let n = 0; n < 3; n++) out[n] = a[n] + (b[n] - a[n]) * t;
    quatFromRotVec(a[r], a[r + 1], a[r + 2], qa);
    quatFromRotVec(b[r], b[r + 1], b[r + 2], qb);
    const v = rotVecFromQuat(qa.slerp(qb, t));
    out[r] = v[0];
    out[r + 1] = v[1];
    out[r + 2] = v[2];
  }
  return out;
}

/** Capsule pairs that can physically meet, with how far soft tissue lets each pair press together in metres. */
export function selfCollisionPairs(body: Body): [number, number, number][] {
  const pairs: [number, number, number][] = [];
  const pair = (a: string, b: string, tolerance = 0.012) =>
    pairs.push([body.colliderIndex[a], body.colliderIndex[b], tolerance]);
  for (const side of SIDES) {
    const other = otherSide(side);
    for (const part of ["abdomen", "pelvis"]) pair(`upperarm_${side}`, part, 0.03);
    pair(`upperarm_${side}`, "chest", 0.035);
    pair(`upperarm_${side}`, "head");
    for (const leg of [`thigh_${side}`, `thigh_${other}`]) pair(`upperarm_${side}`, leg);
    for (const part of ["pelvis", "abdomen", "chest", "girdle", "head", "neck"]) {
      pair(`forearm_${side}`, part, 0.015);
      pair(`hand_${side}`, part, 0.015);
    }
    for (const leg of ["thigh", "shank"]) {
      for (const legSide of SIDES) {
        pair(`forearm_${side}`, `${leg}_${legSide}`);
        pair(`hand_${side}`, `${leg}_${legSide}`);
      }
    }
    pair(`hand_${side}`, `foot_L`);
    pair(`hand_${side}`, `foot_R`);
    pair(`hand_${side}`, `forearm_${other}`);
    pair(`hand_${side}`, `upperarm_${other}`);
    pair(`forearm_${side}`, `upperarm_${other}`);
    pair(`thigh_${side}`, `shank_${other}`);
    pair(`thighShaft_${side}`, "abdomen", 0.04);
    pair(`thighShaft_${side}`, "chest", 0.02);
    pair(`shank_${side}`, `foot_${other}`);
  }
  pair("hand_L", "hand_R");
  pair("forearm_L", "forearm_R");
  pair("thigh_L", "thigh_R", 0.03);
  pair("shank_L", "shank_R");
  pair("foot_L", "foot_R", 0.005);
  return pairs;
}
