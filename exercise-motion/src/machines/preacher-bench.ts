import { ARMS, defineMachine, SEAT_PAD } from "./core";

export type PreacherBenchState = Record<string, never>;

export const preacherBenchMachine = defineMachine<PreacherBenchState>({
  id: "preacher-bench",
  defaults: {},
  nodes: () => ({}),
  contacts: (p) => ({
    [`${p}.arm_pad`]: { ...ARMS, chest: 0.03, abdomen: 0.02 },
    [`${p}.seat_pad`]: SEAT_PAD,
  }),
  cameraHint: { view: "Side" },
});
