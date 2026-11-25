import { clamp } from "../math";
import { BACK_PAD, defineMachine, FEET, HANDS, SEAT_PAD, slideAlong } from "./core";

export interface LegPress45State {
  /** Sled travel up the rail from the bottom stop (m, 0..0.62). */
  sledTravel: number;
}

export const legPress45Machine = defineMachine<LegPress45State>({
  id: "leg-press-45",
  defaults: { sledTravel: 0.3 },
  normalize: (s, spec) => {
    const r = spec.anchors.rails!.sled;
    return { sledTravel: clamp(s.sledTravel, r.minTravel, r.maxTravel) };
  },
  nodes: (s, spec) => ({ sled: slideAlong(spec.anchors.rails!.sled.dir, s.sledTravel) }),
  animatedNodes: ["sled"],
  contacts: (p) => ({
    [`${p}.back_pad`]: BACK_PAD,
    [`${p}.seat_pad`]: SEAT_PAD,
    [`${p}.footplate`]: FEET,
    [`${p}.grip_`]: HANDS,
  }),
  cameraHint: { view: "Side" },
});
