import { BACK_PAD, defineMachine, HANDS } from "./core";

export type DipPullupStationState = Record<string, never>;

export const dipPullupStationMachine = defineMachine<DipPullupStationState>({
  id: "dip-pullup-station",
  defaults: {},
  nodes: () => ({}),
  contacts: (p) => ({
    [`${p}.grip_`]: HANDS,
    [`${p}.dip_`]: HANDS,
    [`${p}.pullup_bar`]: HANDS,
    [`${p}.back_pad`]: BACK_PAD,
  }),
});
