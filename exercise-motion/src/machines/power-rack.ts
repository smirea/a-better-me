import { clamp } from "../math";
import { defineMachine, HANDS, machineSpec, slideY, specParam } from "./core";

export interface PowerRackState {
  /** Height of the J-hook cradle, where the racked bar's underside rests. */
  hookY: number;
  /** Height of the safety arms' top surface. */
  safetyY: number;
}

export const powerRackMachine = defineMachine<PowerRackState>({
  id: "power-rack",
  defaults: { hookY: 1.3, safetyY: 0.7 },
  normalize: (s) => ({ hookY: clamp(s.hookY, 0.35, 1.85), safetyY: clamp(s.safetyY, 0.2, 1.5) }),
  nodes(s, spec) {
    const dh = s.hookY - specParam(spec, "hookY");
    const ds = s.safetyY - specParam(spec, "safetyY");
    return { jhook_L: slideY(dh), jhook_R: slideY(dh), safety_L: slideY(ds), safety_R: slideY(ds) };
  },
  contacts: (p) => ({ [`${p}.grip_`]: HANDS }),
});

/**
 * Rack settings for a squat or press whose bar shaft's underside is at `standingY` when the lifter stands tall and at
 * `bottomY` at the bottom of the rep: the J-hooks one hole below where the bar can still walk out over their lips, and
 * the safeties just under the lowest point so a failed rep lands on them.
 */
export function rackHeightsFor(standingY: number, bottomY: number, clearance = 0.03): { hookY: number; safetyY: number } {
  const spec = machineSpec("power-rack");
  return {
    hookY: standingY - specParam(spec, "hookLip") - clearance,
    safetyY: bottomY - clearance,
  };
}
