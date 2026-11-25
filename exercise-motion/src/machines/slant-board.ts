import { defineMachine, FEET } from "./core";

export type SlantBoardState = Record<string, never>;

export const slantBoardMachine = defineMachine<SlantBoardState>({
  id: "slant-board",
  defaults: {},
  nodes: () => ({}),
  contacts: (p) => ({ [`${p}.deck`]: FEET }),
});
