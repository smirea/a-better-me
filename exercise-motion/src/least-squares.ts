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

    if (k > 0) {
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
      choleskySolve(hessian, solved, k);

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

/** Solves H y = b in place for a symmetric positive-definite H given by its lower triangle, row-major, k by k. */
function choleskySolve(h: Float64Array, b: Float64Array, k: number) {
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = h[i * k + j];
      for (let p = 0; p < j; p++) sum -= h[i * k + p] * h[j * k + p];
      h[i * k + j] = i === j ? Math.sqrt(Math.max(sum, 1e-12)) : sum / h[j * k + j];
    }
  }
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
