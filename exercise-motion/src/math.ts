import { Quaternion, Vector3 } from "three";

export type Vec3 = [number, number, number];

export const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const deg = (radians: number) => (radians * 180) / Math.PI;
export const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const v3 = (v: Vec3) => new Vector3(v[0], v[1], v[2]);

export function quatFromRotVec(x: number, y: number, z: number, out = new Quaternion()) {
  const angle = Math.hypot(x, y, z);
  if (angle < 1e-9) return out.set(x / 2, y / 2, z / 2, 1).normalize();
  const s = Math.sin(angle / 2) / angle;
  return out.set(x * s, y * s, z * s, Math.cos(angle / 2));
}

export function rotVecFromQuat(q: Quaternion): Vec3 {
  const sign = q.w < 0 ? -1 : 1;
  const x = q.x * sign;
  const y = q.y * sign;
  const z = q.z * sign;
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return [2 * x, 2 * y, 2 * z];
  const k = (2 * Math.atan2(s, q.w * sign)) / s;
  return [x * k, y * k, z * k];
}

/** Position profile of a point-to-point human reach: zero velocity and acceleration at both ends. */
export const minJerk = (u: number) => {
  const t = clamp(u, 0, 1);
  return t * t * t * (10 - 15 * t + 6 * t * t);
};

export interface Closest {
  distance: number;
  s: number;
  t: number;
}

const d1 = new Vector3();
const d2 = new Vector3();
const r = new Vector3();
const c1 = new Vector3();
const c2 = new Vector3();

/** Closest approach of segments p1-q1 and p2-q2, with each segment's parameter in [0, 1]. */
export function closestSegments(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): Closest {
  d1.subVectors(q1, p1);
  d2.subVectors(q2, p2);
  r.subVectors(p1, p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s = 0;
  let t = 0;
  if (a <= 1e-12 && e <= 1e-12) {
    return { distance: r.length(), s: 0, t: 0 };
  }
  if (a <= 1e-12) {
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-12) {
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom > 1e-12 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  c1.copy(p1).addScaledVector(d1, s);
  c2.copy(p2).addScaledVector(d2, t);
  return { distance: c1.distanceTo(c2), s, t };
}

/** Solves the symmetric positive definite system A x = b in place of b; A is row-major n x n and is overwritten. */
export function solveCholesky(A: Float64Array, b: Float64Array, n: number) {
  for (let j = 0; j < n; j++) {
    let sum = A[j * n + j];
    for (let k = 0; k < j; k++) sum -= A[j * n + k] * A[j * n + k];
    if (sum <= 0) return false;
    const diag = Math.sqrt(sum);
    A[j * n + j] = diag;
    for (let i = j + 1; i < n; i++) {
      let v = A[i * n + j];
      for (let k = 0; k < j; k++) v -= A[i * n + k] * A[j * n + k];
      A[i * n + j] = v / diag;
    }
  }
  for (let i = 0; i < n; i++) {
    let v = b[i];
    for (let k = 0; k < i; k++) v -= A[i * n + k] * b[k];
    b[i] = v / A[i * n + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let v = b[i];
    for (let k = i + 1; k < n; k++) v -= A[k * n + i] * b[k];
    b[i] = v / A[i * n + i];
  }
  return true;
}
