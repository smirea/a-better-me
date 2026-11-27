export interface SparseColumn {
  rows: Int32Array;
  values: Float64Array;
}

export interface BoundedProblem {
  columns: SparseColumn[];
  /** Per row: what the columns should add up to, and how much a miss on that row costs. */
  target: Float64Array;
  weight: Float64Array;
  /** Per column: the cost of the variable's own square, which must be positive so the answer is unique. */
  ridge: Float64Array;
  lo: Float64Array;
  hi: Float64Array;
}

const FREE = 0;
const LOW = -1;
const HIGH = 1;
const TOLERANCE = 1e-9;

/**
 * The x in [lo, hi] that minimises Σ weight·(A x − target)² + Σ ridge·x², solved exactly by the active-set method
 * for bounded least squares (Stark & Parker, 1995): solve for the variables off their bounds, stop at the first
 * bound one of them would cross, and release a bound variable only when the cost says it should move. Every step
 * lowers the cost, so it always ends. The problem is strictly convex, so its answer is unique and moves
 * continuously with the inputs: neighbouring frames can't disagree about which muscle works. `state` holds which
 * variables sit on a bound and carries from one call to the next, so a frame starts from the previous frame's
 * answer and usually ends in one step.
 */
export function solveBounded(problem: BoundedProblem, x: Float64Array, state: Int8Array) {
  const { columns, target, weight, ridge, lo, hi } = problem;
  const n = columns.length;
  const m = target.length;
  const residual = new Float64Array(m);
  const scratch = new Float64Array(m);
  const free = new Int32Array(n);
  const solved = new Float64Array(n);
  let hessian = new Float64Array(0);
  const root = new Float64Array(m);
  for (let row = 0; row < m; row++) root[row] = Math.sqrt(weight[row]);
  const dual = new Float64Array(m * m);
  const pulled = new Float64Array(m);
  const change = new Float64Array(m);
  const inDual = new Uint8Array(n);
  let factored = false;

  for (let j = 0; j < n; j++) {
    if (hi[j] <= lo[j]) state[j] = LOW;
    else if (state[j] === FREE && (x[j] <= lo[j] || x[j] >= hi[j])) state[j] = x[j] <= lo[j] ? LOW : HIGH;
    if (state[j] !== FREE) x[j] = state[j] === LOW ? lo[j] : hi[j];
  }

  for (let iteration = 0; iteration < 20 * n + 50; iteration++) {
    residual.set(target);
    let k = 0;
    for (let j = 0; j < n; j++) {
      if (state[j] === FREE) {
        free[k++] = j;
        continue;
      }
      if (x[j] === 0) continue;
      const { rows, values } = columns[j];
      for (let e = 0; e < rows.length; e++) residual[rows[e]] -= values[e] * x[j];
    }

    if (k > m) {
      // More free variables than rows: solve in the rows' space, by (R + AᵀWA)⁻¹AᵀW = R⁻¹AᵀS(I + SAR⁻¹AᵀS)⁻¹S
      // with S = √W, an m by m system in place of a k by k one, and the same answer. The columns hold still through
      // a call and only which are free changes, so the factor carries from step to step and a column coming free or
      // going to a bound is a rank-one change to it, unless enough change at once that starting over is cheaper.
      let changes = 0;
      for (let j = 0; factored && j < n; j++) if (+(state[j] === FREE) !== inDual[j]) changes++;
      let current = factored && changes * 6 <= m;
      for (let j = 0; current && j < n; j++) {
        const now = +(state[j] === FREE);
        if (now === inDual[j]) continue;
        current = rankOne(dual, m, columns[j], root, ridge[j], now ? 1 : -1, change);
        inDual[j] = now;
      }
      if (!current) {
        dual.fill(0);
        for (let row = 0; row < m; row++) dual[row * m + row] = 1;
        for (let j = 0; j < n; j++) {
          inDual[j] = +(state[j] === FREE);
          if (!inDual[j]) continue;
          const { rows, values } = columns[j];
          const inverse = 1 / ridge[j];
          for (let e = 0; e < rows.length; e++) {
            const scaled = root[rows[e]] * values[e] * inverse;
            if (scaled === 0) continue;
            for (let f = 0; f < rows.length; f++) {
              if (rows[f] > rows[e]) continue;
              dual[rows[e] * m + rows[f]] += scaled * root[rows[f]] * values[f];
            }
          }
        }
        factor(dual, m);
        factored = true;
      }
      for (let row = 0; row < m; row++) pulled[row] = root[row] * residual[row];
      substitute(dual, pulled, m);
      for (let a = 0; a < k; a++) {
        const j = free[a];
        const { rows, values } = columns[j];
        let sum = 0;
        for (let e = 0; e < rows.length; e++) sum += values[e] * root[rows[e]] * pulled[rows[e]];
        solved[a] = sum / ridge[j];
      }
    } else if (k > 0) {
      if (hessian.length < k * k) hessian = new Float64Array(k * k);
      for (let a = 0; a < k; a++) {
        const column = columns[free[a]];
        let sum = 0;
        for (let e = 0; e < column.rows.length; e++) {
          const row = column.rows[e];
          scratch[row] = column.values[e] * weight[row];
          sum += scratch[row] * residual[row];
        }
        solved[a] = sum;
        for (let c = a; c < k; c++) {
          const other = columns[free[c]];
          let dot = 0;
          for (let e = 0; e < other.rows.length; e++) dot += other.values[e] * scratch[other.rows[e]];
          hessian[c * k + a] = dot;
        }
        hessian[a * k + a] += ridge[free[a]];
        for (let e = 0; e < column.rows.length; e++) scratch[column.rows[e]] = 0;
      }
      factor(hessian, k);
      substitute(hessian, solved, k);
    }

    if (k > 0) {
      let step = 1;
      for (let a = 0; a < k; a++) {
        const j = free[a];
        const move = solved[a] - x[j];
        if (solved[a] < lo[j] - TOLERANCE) step = Math.min(step, (lo[j] - x[j]) / move);
        else if (solved[a] > hi[j] + TOLERANCE) step = Math.min(step, (hi[j] - x[j]) / move);
      }
      if (step < 1) {
        for (let a = 0; a < k; a++) {
          const j = free[a];
          x[j] += step * (solved[a] - x[j]);
          if (solved[a] < lo[j] - TOLERANCE && x[j] <= lo[j] + TOLERANCE) {
            state[j] = LOW;
            x[j] = lo[j];
          } else if (solved[a] > hi[j] + TOLERANCE && x[j] >= hi[j] - TOLERANCE) {
            state[j] = HIGH;
            x[j] = hi[j];
          }
        }
        continue;
      }
      for (let a = 0; a < k; a++) {
        const j = free[a];
        x[j] = Math.min(hi[j], Math.max(lo[j], solved[a]));
        const { rows, values } = columns[j];
        for (let e = 0; e < rows.length; e++) residual[rows[e]] -= values[e] * x[j];
      }
    }

    let worst = -1;
    let most = TOLERANCE;
    for (let j = 0; j < n; j++) {
      if (state[j] === FREE || hi[j] <= lo[j]) continue;
      const { rows, values } = columns[j];
      let gradient = ridge[j] * x[j];
      for (let e = 0; e < rows.length; e++) gradient -= values[e] * weight[rows[e]] * residual[rows[e]];
      const pull = state[j] === LOW ? -gradient : gradient;
      if (pull > most) {
        most = pull;
        worst = j;
      }
    }
    if (worst < 0) return;
    state[worst] = FREE;
  }
}

/** Replaces a symmetric positive-definite H, given by its lower triangle, row-major, k by k, with its Cholesky factor. */
function factor(h: Float64Array, k: number) {
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = h[i * k + j];
      for (let p = 0; p < j; p++) sum -= h[i * k + p] * h[j * k + p];
      h[i * k + j] = i === j ? Math.sqrt(Math.max(sum, 1e-12)) : sum / h[j * k + j];
    }
  }
}

/**
 * Turns the factor of H into the factor of H ± v vᵀ, for v a column of A scaled by S/√ridge, in k² steps where
 * factoring again takes k³/6. False when taking it away would leave H no longer positive-definite.
 */
function rankOne(
  h: Float64Array,
  k: number,
  column: SparseColumn,
  root: Float64Array,
  ridge: number,
  sign: 1 | -1,
  v: Float64Array,
) {
  v.fill(0);
  const scale = 1 / Math.sqrt(ridge);
  let first = k;
  for (let e = 0; e < column.rows.length; e++) {
    const row = column.rows[e];
    v[row] += root[row] * column.values[e] * scale;
    if (v[row] !== 0) first = Math.min(first, row);
  }
  for (let p = first; p < k; p++) {
    if (v[p] === 0) continue;
    const diagonal = h[p * k + p];
    const squared = diagonal * diagonal + sign * v[p] * v[p];
    if (squared <= 1e-12) return false;
    const r = Math.sqrt(squared);
    const c = r / diagonal;
    const s = v[p] / diagonal;
    h[p * k + p] = r;
    for (let i = p + 1; i < k; i++) {
      h[i * k + p] = (h[i * k + p] + sign * s * v[i]) / c;
      v[i] = c * v[i] - s * h[i * k + p];
    }
  }
  return true;
}

/** Solves H y = b in place from H's Cholesky factor. */
function substitute(h: Float64Array, b: Float64Array, k: number) {
  for (let i = 0; i < k; i++) {
    let sum = b[i];
    for (let p = 0; p < i; p++) sum -= h[i * k + p] * b[p];
    b[i] = sum / h[i * k + i];
  }
  for (let i = k - 1; i >= 0; i--) {
    let sum = b[i];
    for (let p = i + 1; p < k; p++) sum -= h[p * k + i] * b[p];
    b[i] = sum / h[i * k + i];
  }
}
