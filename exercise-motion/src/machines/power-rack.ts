import { clamp } from "../math";
import { defineMachine, HANDS, slideY, specParam } from "./core";

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
