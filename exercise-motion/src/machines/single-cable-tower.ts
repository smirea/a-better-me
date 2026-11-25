import { clamp } from "../math";
import type { HandleTracker } from "./dual-adjustable-pulley";
import { defineMachine, machineSpec, rotY, slideY, specParam, stackLift, swivelYaw, type MachineInstance } from "./core";

export interface SingleCableTowerState {
  /** Cable exit height (m). */
  pulleyY: number;
  stack: number;
  /** Swivel yaw from facing -Z (radians about +Y). */
  swivel: number;
}

const ID = "single-cable-tower";

const build = defineMachine<SingleCableTowerState>({
  id: ID,
  defaults: { pulleyY: 1.21, stack: 0, swivel: 0 },
  normalize(s, spec) {
    const rail = spec.anchors.rails!.carriage;
    const bind = specParam(spec, "bindExitY");
    return {
      pulleyY: clamp(s.pulleyY, bind + rail.minTravel, bind + rail.maxTravel),
      stack: clamp(s.stack, 0, specParam(spec, "stackTravel")),
      swivel: s.swivel,
    };
  },
  nodes: (s, spec) => ({
    carriage: slideY(s.pulleyY - specParam(spec, "bindExitY")),
    pulley: rotY(s.swivel),
    stack: slideY(s.stack),
  }),
  contacts: () => ({}),
});

/** Single adjustable column; with `handle`, the swivel tracks it and the stack lifts with cable payout. */
export function singleCableTowerMachine(
  options: Parameters<typeof build>[0] & { handle?: (...a: Parameters<HandleTracker>) => [number, number, number] | undefined; restCable?: number } = {},
): MachineInstance<SingleCableTowerState> {
  const { handle, restCable = 0.3, ...rest } = options;
  if (!handle) return build(rest);
  const probe = build(rest);
  const travel = specParam(machineSpec(ID), "stackTravel");
  return build({
    ...rest,
    drive: (frame, extras, props) => {
      const hand = handle(frame, extras, props);
      if (!hand) return {};
      const pulley = probe.pulleys!.pulley;
      return { stack: stackLift(pulley, hand, restCable, travel), swivel: swivelYaw(pulley, hand, [0, 0, -1]) };
    },
  });
}
