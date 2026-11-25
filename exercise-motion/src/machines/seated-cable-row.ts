import { clamp, type Vec3 } from "../math";
import type { HandleTracker } from "./dual-adjustable-pulley";
import { defineMachine, FEET, machineSpec, SEAT_PAD, slideY, specParam, stackLift, type MachineInstance } from "./core";

export interface SeatedCableRowState {
  stack: number;
}

const ID = "seated-cable-row";

const build = defineMachine<SeatedCableRowState>({
  id: ID,
  defaults: { stack: 0 },
  normalize: (s, spec) => ({ stack: clamp(s.stack, 0, specParam(spec, "stackTravel")) }),
  nodes: (s) => ({ stack: slideY(s.stack) }),
  contacts: (p) => ({ [`${p}.seat_pad`]: SEAT_PAD, [`${p}.footplate_`]: FEET }),
  cameraHint: { view: "Side" },
});

/** Seated row; with `handle` (the attachment's cable eye), the stack lifts as the cable pays out past `restCable`. */
export function seatedCableRowMachine(
  options: Parameters<typeof build>[0] & { handle?: (...a: Parameters<HandleTracker>) => Vec3; restCable?: number } = {},
): MachineInstance<SeatedCableRowState> {
  const { handle, restCable = 0.35, ...rest } = options;
  if (!handle) return build(rest);
  const pulley = build(rest).pulleys!.pulley;
  const travel = specParam(machineSpec(ID), "stackTravel");
  return build({ ...rest, drive: (f, e, p) => ({ stack: stackLift(pulley, handle(f, e, p), restCable, travel) }) });
}
