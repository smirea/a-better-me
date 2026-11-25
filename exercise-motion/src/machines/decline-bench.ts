import { BACK_PAD, defineMachine, SEAT_PAD, SHINS, THIGHS } from "./core";

export type DeclineBenchState = Record<string, never>;

export const declineBenchMachine = defineMachine<DeclineBenchState>({
  id: "decline-bench",
  defaults: {},
  nodes: () => ({}),
  contacts: (p) => ({ [`${p}.back_pad`]: BACK_PAD, [`${p}.seat_pad`]: SEAT_PAD, [`${p}.roller_`]: { ...SHINS, ...THIGHS } }),
  cameraHint: { view: "Side" },
});
