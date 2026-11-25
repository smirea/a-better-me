import { clamp, rad } from "../math";
import { BACK_PAD, defineMachine, HANDS, rotX, SEAT_PAD, SHINS, slideY, specParam, THIGHS } from "./core";

export interface LegExtensionState {
  /** Lever swing from bind toward full knee extension (deg, -5..95). */
  extensionDeg: number;
}

/** Cam radius turning lever rotation into stack lift. */
const CAM = 0.09;

export const legExtensionMachine = defineMachine<LegExtensionState>({
  id: "leg-extension",
  defaults: { extensionDeg: 0 },
  normalize: (s) => ({ extensionDeg: clamp(s.extensionDeg, -5, 95) }),
  nodes: (s, spec) => ({
    lever_arm: rotX(-rad(s.extensionDeg)),
    stack: slideY(clamp(CAM * rad(Math.max(0, s.extensionDeg)), 0, specParam(spec, "stackTravel"))),
  }),
  contacts: (p) => ({
    [`${p}.seat_pad`]: SEAT_PAD,
    [`${p}.back_pad`]: BACK_PAD,
    [`${p}.ankle_pad`]: SHINS,
    [`${p}.thigh_pad`]: THIGHS,
    [`${p}.grip_`]: HANDS,
  }),
  cameraHint: { view: "Side" },
});
