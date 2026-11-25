import { clamp, rad } from "../math";
import { BACK_PAD, defineMachine, HANDS, rotX, SEAT_PAD, SHINS, slideY, specParam, THIGHS } from "./core";

export interface SeatedLegCurlState {
  /** Lever swing from the extended bind pose toward knee flexion (deg, -5..110). */
  curlDeg: number;
}

const CAM = 0.09;

export const seatedLegCurlMachine = defineMachine<SeatedLegCurlState>({
  id: "seated-leg-curl",
  defaults: { curlDeg: 0 },
  normalize: (s) => ({ curlDeg: clamp(s.curlDeg, -5, 110) }),
  nodes: (s, spec) => ({
    lever_arm: rotX(rad(s.curlDeg)),
    stack: slideY(clamp(CAM * rad(Math.max(0, s.curlDeg)), 0, specParam(spec, "stackTravel"))),
  }),
  contacts: (p) => ({
    [`${p}.seat_pad`]: SEAT_PAD,
    [`${p}.back_pad`]: BACK_PAD,
    [`${p}.calf_pad`]: SHINS,
    [`${p}.thigh_pad`]: THIGHS,
    [`${p}.grip_`]: HANDS,
  }),
  cameraHint: { view: "Side" },
});
