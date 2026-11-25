import { statics, type Setup } from "./biomech";
import type { Body } from "./body";
import { Vector3 } from "three";
import type { LoadAttachment } from "./exercise";
import { jointRanges, limbAlongForce, type Goal } from "./solver";

/** What a muscle group working flat out costs a pose, against a centimetre of miss on a contact or a grasp. */
const EFFORT = 3;
/** What a joint torque the muscles cannot meet costs, against the effort of a muscle that could. */
const SHORTFALL = 10;
/** A joint is comfortable through this share of its range either side of the middle, and costs more from there to its end. */
const COMFORTABLE = 0.85;
/** What a joint held at the very end of its range costs, against a muscle working flat out. */
const END_OF_RANGE = 1;
/** Straight is where these joints rest, so the straight end of their range is not a strain. */
const RESTS_STRAIGHT = /^(elbow|knee)_[LR]\.flex$/;

/** What a hand held a radian off the line of what hangs from it costs. */
const HANG = 8;
const DOWN = new Vector3(0, -1, 0);

/**
 * A hand that hangs from a bar or carries a weight turns at the wrist until it lines up with the pull, the way a
 * hook does. Effort alone finds that only from nearby, because a wrist a long way off is a muscle already flat out
 * with nothing left to tell the solve which way is better.
 */
export function handsAlongLoads(body: Body, loads: LoadAttachment[]): Goal[] {
  return loads.flatMap((load) => {
    const side = /^grip_([LR])$/.exec(load.anchor)?.[1];
    if (!side || load.grip !== "hang") return [];
    const pulley = load.pulley && new Vector3(...load.pulley);
    const fixed = load.direction ? new Vector3(...load.direction) : DOWN;
    const pull = new Vector3();
    return [
      limbAlongForce(
        body,
        `wrist_${side}`,
        load.anchor,
        pulley ? (hand) => pull.subVectors(pulley, hand) : fixed,
        HANG,
      ),
    ];
  });
}

/**
 * Makes a pose cost what it takes the muscles to hold it under the exercise's load, so the pose solve settles on
 * the posture a lifter would: forearms under the cable, a bar over the feet, a torso hung where nothing has to hold
 * it up. The forces are the same ones the muscle readout shows, so what looks right and what reads right are one
 * thing. A joint near the end of its range costs too, or least effort would hang every pose on its ligaments.
 */
export function leastEffort(body: Body, setup: Setup, loadKg: number): Goal {
  const solve = statics(body, setup, loadKg);
  return ({ q, frame, angles, push }) => {
    const solved = solve(frame, angles, undefined, { cocontract: false });
    for (let i = 0; i < solved.levels.length; i++) push(EFFORT * solved.levels[i]);
    for (let i = 0; i < solved.shortfall.length; i++) push(EFFORT * SHORTFALL * solved.shortfall[i]);
    jointRanges(body, q, angles, (key, value, lo, hi) => {
      if (!Number.isFinite(lo) || lo <= -Math.PI) lo = hi - 2 * Math.PI;
      const middle = (lo + hi) / 2;
      const half = (hi - lo) / 2;
      const out = (value - middle) / half;
      const strain =
        out < 0 && (RESTS_STRAIGHT.test(key) || lo <= -Math.PI + 1e-6)
          ? 0
          : Math.max(0, (Math.abs(out) - COMFORTABLE) / (1 - COMFORTABLE));
      push(EFFORT * END_OF_RANGE * strain);
    });
  };
}
