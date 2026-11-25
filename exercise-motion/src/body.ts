import { Euler, Quaternion, Vector3 } from "three";
import { clamp, deg, quatFromRotVec, rad, rotVecFromQuat, type Vec3 } from "./math";

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
  /** Another collider whose equipment contact allowances this one shares: the toes press into a footplate as the foot does. */
  contactAs?: string;
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

/** How far the sole sits under the ankle joint, measured on MakeHuman's foot. */
const SOLE = 0.0735;
/** Toe anchors in the ankle's frame on the left foot, on the sole: the toe pads, the big toe's tip, the second toe. */
const TOE_ANCHORS: Record<string, Vec3> = {
  toe: [-0.012, -0.071, 0.185],
  toeTip: [-0.02, -0.068, 0.212],
  secondToe: [-0.018, -0.071, 0.195],
};
/** The palm's contact plane, out from the wrist joint along the palm normal, measured on MakeHuman's hand. */
export const PALM_PLANE = 0.029;
/** The bar radius the grip anchors are placed for: a 29 mm bar. */
export const GRIP_RADIUS = 0.0145;

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
    // The glenohumeral joint sits below the sternoclavicular joint, so a hanging arm doesn't read as a shrug.
    add(`shoulder_${side}`, `clavicle_${side}`, [s * 0.165, -0.026, -0.03], "ball");
    add(`elbow_${side}`, `shoulder_${side}`, [0, -0.331, 0], "hinge", [
      { name: "flex", axis: X, sign: -1, limit: limit(0, 150) },
    ]);
    add(`forearm_${side}`, `elbow_${side}`, [0, 0, 0], "hinge", [
      { name: "pron", axis: Y, sign: -s, limit: limit(-85, 85) },
    ]);
    add(`wrist_${side}`, `forearm_${side}`, [0, -0.26, 0], "universal", [
      { name: "flex", axis: Z, sign: -s, limit: limit(-85, 80) },
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
  // The toes come after every other joint so adding them left the earlier joints' degrees of freedom where they were.
  for (const side of SIDES) {
    const s = sideSign(side);
    // The metatarsophalangeal break, at the midpoint of MakeHuman's first and fifth toe heads. Its axis runs through
    // both heads, medial to lateral: the fifth sits 5 mm further back and 10 mm lower, so a heel rise rolls the foot
    // slightly outward as it does on a real forefoot. Positive extension lifts the heel off toes that stay flat.
    add(`toes_${side}`, `ankle_${side}`, [-s * 0.0055, -0.0438, 0.1393], "hinge", [
      { name: "ext", axis: [s * 0.9883, -0.1303, -0.0703], sign: -s, limit: limit(-35, 75) },
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
    seg(`foot_${side}`, `ankle_${side}`, [0, -0.038, 0.05], 0.0125);
    seg(`toes_${side}`, `toes_${side}`, [-sideSign(side) * 0.01, -0.012, 0.035], 0.002);
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
    // The palm, flush with its contact plane, so a hand flat on the floor or a bench sits on it rather than in it.
    cap(`hand_${side}`, `wrist_${side}`, [-s * (PALM_PLANE - 0.023), -0.03, 0], [-s * (PALM_PLANE - 0.023), -0.095, 0], 0.023);
    cap(`thigh_${side}`, `hip_${side}`, [0, 0, 0], [0, -0.436, 0], 0.085, 0.058);
    cap(`thighShaft_${side}`, `hip_${side}`, [0, -0.16, 0], [0, -0.436, 0], 0.075, 0.058, false);
    cap(`shank_${side}`, `knee_${side}`, [0, 0, 0], [0, -0.438, 0], 0.056, 0.038);
    // The sole sits 73 mm under the ankle on MakeHuman's foot. The hindfoot capsule ends under the metatarsal heads
    // and the forefoot rides the toes, a millimetre above the sole so flat toes never read as sunk into the floor.
    cap(`foot_${side}`, `ankle_${side}`, [0, -0.037, -0.025], [-s * 0.004, -0.046, 0.125], 0.036, 0.027);
    cap(`toes_${side}`, `toes_${side}`, [-s * 0.006, -0.01, 0.008], [-s * 0.014, -0.008, 0.064], 0.017, 0.013);
    colliders[colliderIndex[`toes_${side}`]].contactAs = `foot_${side}`;
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
  anchor("chestFront", "thoracic", [0, 0.16, 0.145]);
  anchor("belly", "lumbar", [0, 0.07, 0.12]);
  anchor("sacrum", "pelvis", [0, 0.02, -0.115]);
  anchor("pelvisBottom", "pelvis", [0, -0.085, -0.01]);
  anchor("pelvisFront", "pelvis", [0, 0.02, 0.11]);
  anchor("occiput", "neck", [0, 0.165, -0.075]);
  anchor("mouth", "neck", [0, 0.115, 0.105]);
  anchor("forehead", "neck", [0, 0.18, 0.11]);
  anchor("headTop", "neck", [0, 0.27, 0.02]);
  for (const side of SIDES) {
    const s = sideSign(side);
    anchor(`headSide_${side}`, "neck", [s * 0.095, 0.165, 0.02]);
    anchor(`frontRack_${side}`, "thoracic", [s * 0.155, 0.265, 0.095]);
    anchor(`shoulderTop_${side}`, "thoracic", [s * 0.17, 0.31, 0.01]);
    // Measured on MakeHuman's hand: the palm faces the thigh in the neutral pose (local -sX), the fingers run down
    // (-Y), and a bar held across the palm runs along Z, thumb side first. The palm's contact plane, which the heel
    // of the hand and the pads under the knuckles both touch, sits `PALM_PLANE` out from the wrist joint.
    // grip: the middle of a 29 mm bar closed in the fingers across the distal palm, pressing 2 mm into the skin.
    anchor(`grip_${side}`, `wrist_${side}`, [-s * (PALM_PLANE + GRIP_RADIUS - 0.002), -0.092, 0]);
    // press: the same bar seated low in the heel of the hand, as a bench press holds it: as near the wrist as the
    // fingers still close around it, since MakeHuman's palm is rigid where a real one cups.
    anchor(`press_${side}`, `wrist_${side}`, [-s * (PALM_PLANE + GRIP_RADIUS - 0.003), -0.066, 0]);
    // palm: the centre of the flat palm's contact patch. knuckles: the pads under the knuckles. fingertips: the
    // middle finger's pad when the fingers lie flat on the palm plane.
    anchor(`palm_${side}`, `wrist_${side}`, [-s * PALM_PLANE, -0.07, 0]);
    anchor(`knuckles_${side}`, `wrist_${side}`, [-s * PALM_PLANE, -0.108, 0]);
    anchor(`fingertips_${side}`, `wrist_${side}`, [-s * PALM_PLANE, -0.2, 0.005]);
    anchor(`palmFlat_${side}`, `wrist_${side}`, [-s * PALM_PLANE, -0.07, 0]);
    anchor(`elbowTip_${side}`, `elbow_${side}`, [0, 0, -0.044]);
    anchor(`forearmMid_${side}`, `elbow_${side}`, [0, -0.135, -0.036]);
    anchor(`upperArmBack_${side}`, `shoulder_${side}`, [0, -0.2, -0.048]);
    anchor(`thighBack_${side}`, `hip_${side}`, [0, -0.22, -0.08]);
    anchor(`thighFront_${side}`, `hip_${side}`, [0, -0.22, 0.08]);
    anchor(`thighOuter_${side}`, `hip_${side}`, [s * 0.082, -0.24, 0]);
    anchor(`thighInner_${side}`, `hip_${side}`, [-s * 0.075, -0.24, 0]);
    anchor(`kneeFront_${side}`, `knee_${side}`, [0, -0.01, 0.06]);
    anchor(`kneeBack_${side}`, `knee_${side}`, [0, -0.01, -0.056]);
    anchor(`shinFront_${side}`, `knee_${side}`, [0, -0.34, 0.046]);
    anchor(`shinBack_${side}`, `knee_${side}`, [0, -0.34, -0.046]);
    anchor(`ankleCuff_${side}`, `ankle_${side}`, [0, 0.04, 0]);
    // The sole, from MakeHuman's foot: the heel pad and the skin under the first and fifth metatarsal heads ride the
    // hindfoot; the toe pads and the tip of the second toe ride the toes.
    anchor(`heel_${side}`, `ankle_${side}`, [0, -SOLE, -0.05]);
    anchor(`ballIn_${side}`, `ankle_${side}`, [-s * 0.04, -SOLE, 0.14]);
    anchor(`ballOut_${side}`, `ankle_${side}`, [s * 0.034, -SOLE, 0.134]);
    const toes = joints[index[`toes_${side}`]].offset;
    // forefoot: the sole straight under the toe joint, which is where the forefoot meets the floor whatever the toe break,
    // as the metatarsal heads roll on it.
    anchor(`forefoot_${side}`, `toes_${side}`, [0, -SOLE - toes.y / k, 0]);
    for (const [name, [x, y, z]] of Object.entries(TOE_ANCHORS))
      anchor(`${name}_${side}`, `toes_${side}`, [s * x - toes.x / k, y - toes.y / k, z - toes.z / k]);
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
      ankleHeight: SOLE * k,
      hipHeight: (0.436 + 0.438 + SOLE) * k,
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

const hinted = (hints: PoseHints, joint: Joint, motion: string) =>
  hints[`${joint.name}.${motion}`] !== undefined ||
  (joint.side !== null && hints[`${joint.name.slice(0, -2)}.${motion}`] !== undefined);

/**
 * The collarbone's share of an arm lifted overhead, in degrees, by scapulohumeral rhythm: the shoulder girdle starts
 * to rise past about 30° of arm elevation and has risen about 30° by the time the arm is overhead. Without it an arm
 * at 170° turns entirely at the glenohumeral joint, which no shoulder can do, and the armpit's skin crumples.
 */
export const clavicleRhythm = (armElevation: number) => clamp(0.22 * (armElevation - 30), 0, 30);

/**
 * A full pose from anatomical angles in degrees. A key without a side (`hip.flex`) applies to both sides. The root
 * takes `root.x`, `root.y`, `root.z` in metres and `root.pitch` in degrees, positive leaning forward. A collarbone
 * left unhinted follows its arm by `clavicleRhythm`.
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
      const pitch = rad(hints["root.pitch"] ?? 0);
      const yaw = rad(hints["root.yaw"] ?? 0);
      const roll = rad(hints["root.roll"] ?? 0);
      if (yaw === 0 && roll === 0) {
        q[3] = pitch;
      } else {
        euler.set(pitch, yaw, roll, "YXZ");
        const v = rotVecFromQuat(qa.setFromEuler(euler));
        q[3] = v[0];
        q[4] = v[1];
        q[5] = v[2];
      }
      continue;
    }
    if (joint.kind === "hinge" || joint.kind === "universal") {
      joint.dofs.forEach((dof, n) => (q[i + n] = hint(hints, joint, dof.name)));
      if (joint.name.startsWith("clavicle") && !hinted(hints, joint, "elev")) {
        const arm = body.joints[body.index[`shoulder_${joint.side}`]];
        q[i + joint.dofs.findIndex((dof) => dof.name === "elev")] = rad(clavicleRhythm(deg(hint(hints, arm, "elev"))));
      }
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
    for (const foot of ["foot", "toes"]) for (const footSide of SIDES) pair(`hand_${side}`, `${foot}_${footSide}`);
    pair(`hand_${side}`, `forearm_${other}`);
    pair(`hand_${side}`, `upperarm_${other}`);
    pair(`forearm_${side}`, `upperarm_${other}`);
    pair(`thigh_${side}`, `shank_${other}`);
    pair(`thighShaft_${side}`, "abdomen", 0.04);
    pair(`thighShaft_${side}`, "chest", 0.02);
    pair(`shank_${side}`, `foot_${other}`);
    pair(`shank_${side}`, `toes_${other}`);
    pair(`foot_${side}`, `toes_${other}`, 0.005);
  }
  pair("hand_L", "hand_R");
  pair("forearm_L", "forearm_R");
  pair("thigh_L", "thigh_R", 0.03);
  pair("shank_L", "shank_R");
  pair("foot_L", "foot_R", 0.005);
  pair("toes_L", "toes_R", 0.005);
  return pairs;
}
