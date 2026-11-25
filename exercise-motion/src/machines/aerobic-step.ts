import { defineMachine, FEET } from "./core";

export type AerobicStepState = Record<string, never>;

export const aerobicStepMachine = defineMachine<AerobicStepState>({
  id: "aerobic-step",
  defaults: {},
  nodes: () => ({}),
  contacts: (p) => ({ [`${p}.deck`]: { ...FEET, pelvis: 0.02, hand_L: 0.02, hand_R: 0.02 } }),
});
