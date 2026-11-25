import { clamp } from "../math";
import { defineMachine, FEET, HANDS, SHINS, slideAlong, THIGHS } from "./core";

export interface BackExtensionBenchState {
  /** Hip pad slide along the 45° body line from its bind position (m). */
  hipPadTravel: number;
}

export const backExtensionBenchMachine = defineMachine<BackExtensionBenchState>({
  id: "back-extension-bench",
  defaults: { hipPadTravel: 0 },
  normalize: (s, spec) => {
    const r = spec.anchors.rails!.hip_pad;
    return { hipPadTravel: clamp(s.hipPadTravel, r.minTravel, r.maxTravel) };
  },
  nodes: (s, spec) => ({ hip_pad: slideAlong(spec.anchors.rails!.hip_pad.dir, s.hipPadTravel) }),
  contacts: (p) => ({
    [`${p}.hip_pad`]: { ...THIGHS, pelvis: 0.03 },
    [`${p}.ankle_roller`]: SHINS,
    [`${p}.footplate`]: FEET,
    [`${p}.grip_`]: HANDS,
  }),
  cameraHint: { view: "Side" },
});
