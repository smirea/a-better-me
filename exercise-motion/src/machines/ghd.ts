import { clamp } from "../math";
import { defineMachine, FEET, HANDS, SHINS, slideAlong, THIGHS } from "./core";

export interface GhdState {
  /** Foot carriage slide along Z from bind (m). */
  footTravel: number;
}

export const ghdMachine = defineMachine<GhdState>({
  id: "ghd",
  defaults: { footTravel: 0 },
  normalize: (s, spec) => {
    const r = spec.anchors.rails!.foot_carriage;
    return { footTravel: clamp(s.footTravel, r.minTravel, r.maxTravel) };
  },
  nodes: (s, spec) => ({ foot_carriage: slideAlong(spec.anchors.rails!.foot_carriage.dir, s.footTravel) }),
  contacts: (p) => ({
    [`${p}.hip_pad`]: { ...THIGHS, pelvis: 0.03, abdomen: 0.03 },
    [`${p}.ankle_roller_`]: SHINS,
    [`${p}.footplate`]: FEET,
    [`${p}.grip_`]: HANDS,
  }),
  cameraHint: { view: "Side" },
});
