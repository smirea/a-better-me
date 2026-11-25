import type { Vec3 } from "../math";
import { clamp, rad } from "../math";
import { defineMachine, HANDS, rotX, rotY, type MachineInstance } from "./core";

export interface LandmineState {
  /** Turn of the sleeve about +Y from pointing at -Z (deg). */
  yawDeg: number;
  /** Rise of the sleeve's free end above horizontal (deg). */
  pitchDeg: number;
}

const build = defineMachine<LandmineState>({
  id: "landmine",
  defaults: { yawDeg: 0, pitchDeg: 30 },
  normalize: (s) => ({ yawDeg: clamp(s.yawDeg, -90, 90), pitchDeg: clamp(s.pitchDeg, -2, 70) }),
  nodes: (s) => ({ yaw: rotY(rad(s.yawDeg)), sleeve: rotX(rad(s.pitchDeg)) }),
  contacts: (p) => ({ [`${p}.sleeve`]: HANDS }),
});

/** Landmine; with `barEnd`, the sleeve aims at the bar's free end every frame. */
export function landmineMachine(
  options: Parameters<typeof build>[0] & { barEnd?: (...a: Parameters<NonNullable<MachineInstance<LandmineState>["glbState"]>>) => Vec3 } = {},
): MachineInstance<LandmineState> {
  const { barEnd, ...rest } = options;
  if (!barEnd) return build(rest);
  const pivot = build(rest).pivots!.sleeve.origin;
  return build({
    ...rest,
    drive: (f, e, p) => {
      const [x, y, z] = barEnd(f, e, p);
      const dx = x - pivot[0];
      const dy = y - pivot[1];
      const dz = z - pivot[2];
      return { yawDeg: (Math.atan2(-dx, -dz) * 180) / Math.PI, pitchDeg: (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI };
    },
  });
}
