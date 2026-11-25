import { clamp, type Vec3 } from "../math";
import type { HandleTracker } from "./dual-adjustable-pulley";
import { defineMachine, machineSpec, SEAT_PAD, slideY, specParam, stackLift, THIGHS, type MachineInstance } from "./core";

export interface LatPulldownState {
  /** Thigh roller height change from bind (m, -0.10..0.12). */
  thighPadOffset: number;
  stack: number;
}

const ID = "lat-pulldown";

const build = defineMachine<LatPulldownState>({
  id: ID,
  defaults: { thighPadOffset: 0, stack: 0 },
  normalize: (s, spec) => {
    const r = spec.anchors.rails!.thigh_pad;
    return {
      thighPadOffset: clamp(s.thighPadOffset, r.minTravel, r.maxTravel),
      stack: clamp(s.stack, 0, specParam(spec, "stackTravel")),
    };
  },
  nodes: (s) => ({ thigh_pad: slideY(s.thighPadOffset), stack: slideY(s.stack) }),
  contacts: (p) => ({ [`${p}.seat_pad`]: SEAT_PAD, [`${p}.thigh_pad`]: THIGHS }),
  cameraHint: { view: "Side" },
});

/** Lat pulldown; with `bar` (the bar's cable eye), the stack lifts as the cable pays out past `restCable`. */
export function latPulldownMachine(
  options: Parameters<typeof build>[0] & { bar?: (...a: Parameters<HandleTracker>) => Vec3; restCable?: number } = {},
): MachineInstance<LatPulldownState> {
  const { bar, restCable = 0.25, ...rest } = options;
  if (!bar) return build(rest);
  const pulley = build(rest).pulleys!.pulley;
  const travel = specParam(machineSpec(ID), "stackTravel");
  return build({ ...rest, drive: (f, e, p) => ({ stack: stackLift(pulley, bar(f, e, p), restCable, travel) }) });
}
