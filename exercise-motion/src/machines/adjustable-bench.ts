import { clamp, rad } from "../math";
import { BACK_PAD, defineMachine, rotX, SEAT_PAD, specParam } from "./core";

export interface AdjustableBenchState {
  /** Backrest above horizontal: 0 flat, 30/45 incline, 80–85 upright. */
  backAngleDeg: number;
  /** Seat front raised, 0–20°. Defaults to 12° once the back is inclined past 15°. */
  seatTiltDeg?: number;
}

export const adjustableBenchMachine = defineMachine<AdjustableBenchState>({
  id: "adjustable-bench",
  defaults: { backAngleDeg: 0 },
  normalize: (s) => ({
    backAngleDeg: clamp(s.backAngleDeg, 0, 85),
    seatTiltDeg: clamp(s.seatTiltDeg ?? (s.backAngleDeg >= 15 ? 12 : 0), 0, 20),
  }),
  nodes(s, spec) {
    const theta = rad(s.backAngleDeg);
    // The strut hangs from the backrest and its foot must land on the ladder line: solve that closure.
    const hinge = spec.params.hinge as number[];
    const strut = spec.nodes.back_strut.pivot;
    const ay = hinge[1] + (strut[1] - hinge[1]) * Math.cos(theta) - (strut[2] - hinge[2]) * Math.sin(theta);
    const length = specParam(spec, "strutLength");
    const dy = specParam(spec, "ladderY") - ay;
    const dz = -Math.sqrt(Math.max(length * length - dy * dy, 0));
    const phi = Math.atan2(dy, -dz) - theta;
    return {
      backrest: rotX(theta),
      back_strut: rotX(phi),
      seat: rotX(-rad(s.seatTiltDeg ?? 0)),
    };
  },
  contacts: (p) => ({ [`${p}.back_pad`]: BACK_PAD, [`${p}.seat_pad`]: SEAT_PAD }),
  cameraHint: { view: "Side" },
});
