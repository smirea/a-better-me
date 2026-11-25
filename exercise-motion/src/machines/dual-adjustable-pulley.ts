import type { Frame } from "../body";
import type { PropState } from "../equipment";
import { clamp, type Vec3 } from "../math";
import { defineMachine, HANDS, machineSpec, rotY, slideY, specParam, stackLift, swivelYaw, type MachineInstance } from "./core";

export interface DualAdjustablePulleyState {
  /** Cable exit height on both columns (m). */
  pulleyY: number;
  pulleyYL?: number;
  pulleyYR?: number;
  /** Weight-stack lift (m). */
  stackL: number;
  stackR: number;
  /** Swivel housing yaw from facing +Z (radians about +Y). */
  swivelL: number;
  swivelR: number;
}

const build = defineMachine<DualAdjustablePulleyState>({
  id: "dual-adjustable-pulley",
  defaults: { pulleyY: 1.21, stackL: 0, stackR: 0, swivelL: 0, swivelR: 0 },
  normalize(s, spec) {
    const travel = specParam(spec, "stackTravel");
    const rail = spec.anchors.rails!.carriage_L;
    const bind = specParam(spec, "bindExitY");
    const y = (v: number) => clamp(v, bind + rail.minTravel, bind + rail.maxTravel);
    // Side heights stay unset unless given, so `.at({ pulleyY })` still moves both columns.
    return {
      ...s,
      pulleyY: y(s.pulleyY),
      ...(s.pulleyYL === undefined ? {} : { pulleyYL: y(s.pulleyYL) }),
      ...(s.pulleyYR === undefined ? {} : { pulleyYR: y(s.pulleyYR) }),
      stackL: clamp(s.stackL, 0, travel),
      stackR: clamp(s.stackR, 0, travel),
    };
  },
  nodes(s, spec) {
    const bind = specParam(spec, "bindExitY");
    return {
      carriage_L: slideY((s.pulleyYL ?? s.pulleyY) - bind),
      carriage_R: slideY((s.pulleyYR ?? s.pulleyY) - bind),
      pulley_L: rotY(s.swivelL),
      pulley_R: rotY(s.swivelR),
      stack_L: slideY(s.stackL),
      stack_R: slideY(s.stackR),
    };
  },
  contacts: (p) => ({ [`${p}.grip_`]: HANDS }),
});

export type HandleTracker = (frame: Frame, extras: number[], propStates: PropState[]) => { L?: Vec3; R?: Vec3 };

/**
 * Dual pulley whose swivels turn toward the handles and whose stacks lift with the cable paid out
 * past `restCable` (the cable length at the rep's start, measured from each exit).
 */
export function dualAdjustablePulleyMachine(
  options: Partial<DualAdjustablePulleyState> & Parameters<typeof build>[0] & { handles?: HandleTracker; restCable?: number } = {},
): MachineInstance<DualAdjustablePulleyState> {
  const { handles, restCable = 0.3, ...rest } = options;
  if (!handles) return build(rest);
  const probe = build(rest);
  const travel = specParam(machineSpec("dual-adjustable-pulley"), "stackTravel");
  return build({
    ...rest,
    drive: (frame, extras, props) => {
      const h = handles(frame, extras, props);
      const out: Partial<DualAdjustablePulleyState> = {};
      for (const side of ["L", "R"] as const) {
        const hand = h[side];
        if (!hand) continue;
        const swivel = swivelYaw(probe.at({ [`swivel${side}`]: 0 }), `pulley_${side}`, hand);
        const outlet = probe.at({ [`swivel${side}`]: swivel }).pulleys![`pulley_${side}`];
        out[`swivel${side}`] = swivel;
        out[`stack${side}`] = stackLift(outlet, hand, restCable, travel);
      }
      return out;
    },
  });
}

