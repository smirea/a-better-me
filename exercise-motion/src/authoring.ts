import { Vector3 } from "three";
import { anchorPoint, sideSign, worldPoint, type Body, type Frame, type PoseHints, type Side } from "./body";
import { IDENTITY, type PropState } from "./equipment";
import { rad, type Vec3 } from "./math";
import type { Goal } from "./solver";

export function rollerOnAnchors(
  body: Body,
  frame: Frame,
  anchors: string[],
  offset: Vec3 = [0, 0, 0],
  localOffset?: Vec3,
): PropState {
  const sum = new Vector3();
  const localVec = localOffset ? new Vector3(...localOffset) : null;
  const worldOff = new Vector3();
  for (const a of anchors) {
    sum.add(anchorPoint(body, frame, a));
    if (localVec) {
      const joint = body.anchors[a].joint;
      sum.add(worldOff.copy(localVec).applyQuaternion(frame.rot[joint]));
    }
  }
  sum.divideScalar(Math.max(1, anchors.length));
  return {
    pos: [sum.x + offset[0], sum.y + offset[1], sum.z + offset[2]],
    quat: IDENTITY,
  };
}

/** Builds unilateral or side-specific hints: applies `active` to `side` and `inactive` to the opposite side. */
export function sidedHints(
  activeSide: Side,
  active: PoseHints,
  inactive: PoseHints = {},
  shared: PoseHints = {},
): PoseHints {
  const other: Side = activeSide === "L" ? "R" : "L";
  const out: PoseHints = { ...shared };
  const put = (src: PoseHints, side: Side) => {
    for (const [k, v] of Object.entries(src)) {
      if (k.includes("_L.") || k.includes("_R.") || k.startsWith("root.") || k.startsWith("lumbar.") || k.startsWith("thoracic.") || k.startsWith("neck.")) {
        out[k] = v;
      } else {
        const dot = k.indexOf(".");
        if (dot > 0) out[`${k.slice(0, dot)}_${side}${k.slice(dot)}`] = v;
        else out[k] = v;
      }
    }
  };
  put(inactive, other);
  put(active, activeSide);
  return out;
}

/** Mirrors every `_L`/`_R` key and negates lateral/rotational trunk DOFs (`bend`, `twist`, `root.x`, `root.yaw`, `root.roll`). */
export function mirrorHints(hints: PoseHints): PoseHints {
  const out: PoseHints = {};
  for (const [k, v] of Object.entries(hints)) {
    if (k.includes("_L.")) {
      out[k.replace("_L.", "_R.")] = v;
    } else if (k.includes("_R.")) {
      out[k.replace("_R.", "_L.")] = v;
    } else if (
      k === "root.x" ||
      k === "root.yaw" ||
      k === "root.roll" ||
      k.endsWith(".bend") ||
      k.endsWith(".twist")
    ) {
      out[k] = -v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function keepHandsOnBar(
  body: Body,
  gripX: number,
  anchorPrefix: "grip" | "press" = "grip",
  weight = 24,
): Goal {
  const aL = body.anchors[`${anchorPrefix}_L`];
  const aR = body.anchors[`${anchorPrefix}_R`];
  const pL = new Vector3();
  const pR = new Vector3();
  return ({ frame, push }) => {
    worldPoint(frame, aL.joint, aL.local, pL);
    worldPoint(frame, aR.joint, aR.local, pR);
    push(weight * (pL.x - gripX));
    push(weight * (pR.x + gripX));
    push(weight * (pL.y - pR.y));
    push(weight * (pL.z - pR.z));
  };
}

export function holdElbowNearShoulder(
  body: Body,
  side: Side,
  offset: Vec3 = [0, -0.29, 0.02],
  weight = 12,
  axes = "xz",
): Goal {
  const s = sideSign(side);
  const shIdx = body.index[`shoulder_${side}`];
  const elIdx = body.index[`elbow_${side}`];
  return ({ frame, push }) => {
    const sh = frame.pos[shIdx];
    const el = frame.pos[elIdx];
    if (axes.includes("x")) push(weight * (el.x - (sh.x + s * offset[0])));
    if (axes.includes("y")) push(weight * (el.y - (sh.y + offset[1])));
    if (axes.includes("z")) push(weight * (el.z - (sh.z + offset[2])));
  };
}

export function lockTorsoPitch(body: Body, targetDeg: number, weight = 32): Goal {
  const up = new Vector3();
  const targetRad = rad(targetDeg);
  return ({ frame, push }) => {
    up.set(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
    push(weight * (Math.atan2(up.z, up.y) - targetRad));
  };
}

