import { clamp } from "../math";
import { defineMachine, HANDS, slideY, specParam } from "./core";

export interface SmithMachineState {
  /** Bar center height (m). */
  barY: number;
  /** Top of the safety stops (m). */
  safetyY: number;
}

export const smithMachineMachine = defineMachine<SmithMachineState>({
  id: "smith-machine",
  defaults: { barY: 1.3, safetyY: 0.6 },
  normalize: (s, spec) => {
    const bind = specParam(spec, "barY");
    const r = spec.anchors.rails!.carriage;
    return { barY: clamp(s.barY, bind + r.minTravel, bind + r.maxTravel), safetyY: clamp(s.safetyY, 0.2, 1.4) };
  },
  nodes(s, spec) {
    const ds = s.safetyY - specParam(spec, "safetyY");
    return { carriage: slideY(s.barY - specParam(spec, "barY")), safety_L: slideY(ds), safety_R: slideY(ds) };
  },
  animatedNodes: ["carriage"],
  contacts: (p) => ({ [`${p}.bar`]: { ...HANDS, girdle: 0.03, neck: 0.01, chest: 0.02 },
    [`${p}.grip_`]: HANDS }),
});
