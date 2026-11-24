import type { Angles, Frame } from "./body";
import type { CheckContext } from "./exercise";

export const within = (value: number, lo: number, hi: number) => value >= lo && value <= hi;

/** Passes when a per-frame measurement stays at or under `limit` through the whole rep, and reports its peak. */
export function everyFrame(
  context: CheckContext,
  measure: (frame: Frame, angles: Angles, index: number) => number,
  limit: number,
  unit: string,
) {
  let worst = -Infinity;
  context.frames.forEach(
    (frame, i) => (worst = Math.max(worst, measure(frame, context.angles[i], i))),
  );
  return { pass: worst <= limit, measured: `peaks at ${worst.toFixed(1)}${unit} (limit ${limit})` };
}
