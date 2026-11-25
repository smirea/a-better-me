import { clamp, rad } from "../math";
import { BACK_PAD, defineMachine, HANDS, rotX, SEAT_PAD, slideY, specParam } from "./core";

export interface ChestPressState {
  /** Forward swing of both arms from the chest (deg, -10..40). */
  pressDeg: number;
  pressDegL?: number;
  pressDegR?: number;
}

/** Stack lift per radian of arm swing (lever ratio). */
const LIFT = 0.42;

export const chestPressMachine = defineMachine<ChestPressState>({
  id: "chest-press-machine",
  defaults: { pressDeg: 0 },
  normalize: (s) => ({
    pressDeg: clamp(s.pressDeg, -10, 40),
    pressDegL: clamp(s.pressDegL ?? s.pressDeg, -10, 40),
    pressDegR: clamp(s.pressDegR ?? s.pressDeg, -10, 40),
  }),
  nodes(s, spec) {
    const l = s.pressDegL ?? s.pressDeg;
    const r = s.pressDegR ?? s.pressDeg;
    const lift = LIFT * rad(Math.max(0, (l + r) / 2));
    return {
      arm_L: rotX(-rad(l)),
      arm_R: rotX(-rad(r)),
      stack: slideY(clamp(lift, 0, specParam(spec, "stackTravel"))),
    };
  },
  contacts: (p) => ({ [`${p}.back_pad`]: BACK_PAD, [`${p}.seat_pad`]: SEAT_PAD, [`${p}.grip_`]: HANDS }),
});
