import { BACK_PAD, defineMachine, SEAT_PAD } from "./core";

export type OlympicInclineBenchState = Record<string, never>;

export const olympicInclineBenchMachine = defineMachine<OlympicInclineBenchState>({
  id: "olympic-incline-bench",
  defaults: {},
  nodes: () => ({}),
  contacts: (p) => ({ [`${p}.back_pad`]: BACK_PAD, [`${p}.seat_pad`]: SEAT_PAD }),
  cameraHint: { view: "Side" },
});
