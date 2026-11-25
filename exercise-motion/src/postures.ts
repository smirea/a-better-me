import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type Frame, type Side } from "./body";
import { everyFrame, within } from "./checks";
import type { PadSurface } from "./equipment-library";
import { pointOnPad } from "./equipment-library";
import type { FormCheck } from "./exercise";
import { deg } from "./math";
import { aim, pin, plantFoot, plantToe, restOnPlane, type Goal } from "./solver";
import type { PoseHints } from "./body";

/**
 * FK-verified starting hint poses for the 1.78 m body (`shank=0.438, ankleH=0.069 => knee-to-sole=0.507 m`,
 * `pelvisBottom` sits ~0.085 m below hip joint so horizontal-thigh seated height with flat feet is `seatY ≈ 0.42–0.44 m`).
 */
export const POSTURE_HINTS: Record<string, PoseHints> = {
  standing: {
    "root.y": 0.943,
    "root.z": 0,
    "root.pitch": 0,
    "hip.flex": 2,
    "hip.abd": 4,
    "hip.rot": 6,
    "knee.flex": 3,
    "ankle.dorsi": 1,
  },
  seated: {
    "root.y": 0.505,
    "root.z": 0,
    "root.pitch": 0,
    "hip.flex": 88,
    "hip.abd": 10,
    "hip.rot": 6,
    "knee.flex": 88,
    "ankle.dorsi": 0,
  },
  seatedLeanBack: {
    "root.y": 0.5,
    "root.z": -0.02,
    "root.pitch": -12,
    "hip.flex": 76,
    "hip.abd": 10,
    "hip.rot": 6,
    "knee.flex": 88,
    "ankle.dorsi": 0,
  },
  incline45: {
    "root.y": 0.51,
    "root.z": -0.02,
    "root.pitch": -45,
    "hip.flex": 52,
    "hip.abd": 14,
    "hip.rot": 6,
    "knee.flex": 92,
    "ankle.dorsi": 2,
  },
  incline30: {
    "root.y": 0.51,
    "root.z": -0.02,
    "root.pitch": -60,
    "hip.flex": 36,
    "hip.abd": 14,
    "hip.rot": 6,
    "knee.flex": 92,
    "ankle.dorsi": 2,
  },
  supineFlat: {
    "root.y": 0.545,
    "root.z": 0,
    "root.pitch": -80,
    "lumbar.flex": -10,
    "thoracic.flex": -6,
    "neck.flex": 8,
    "hip.flex": -4,
    "hip.abd": 16,
    "hip.rot": 6,
    "knee.flex": 88,
    "ankle.dorsi": 2,
  },
  supineFloor: {
    "root.y": 0.115,
    "root.z": 0,
    "root.pitch": -88,
    "hip.flex": 55,
    "hip.abd": 10,
    "knee.flex": 95,
    "ankle.dorsi": 10,
  },
  pronePlank: {
    "root.y": 0.36,
    "root.z": 0,
    "root.pitch": 82,
    "hip.flex": 4,
    "hip.abd": 5,
    "knee.flex": 4,
    "ankle.dorsi": 15,
  },
  kneeling: {
    "root.y": 0.5,
    "root.z": 0,
    "root.pitch": 0,
    "hip.flex": 2,
    "hip.abd": 6,
    "knee.flex": 92,
    "ankle.dorsi": -35,
  },
  hanging: {
    "root.y": 1.22,
    "root.z": 0,
    "root.pitch": 0,
    "hip.flex": 6,
    "hip.abd": 4,
    "knee.flex": 25,
    "shoulder.elev": 172,
    "shoulder.plane": 20,
    "elbow.flex": 4,
  },
};

/** Common resting collider penetration allowances for benches, seats, and pads. */
export const PAD_RESTING: Record<string, number> = {
  pelvis: 0.042,
  abdomen: 0.03,
  chest: 0.04,
  girdle: 0.04,
  neck: 0.02,
  head: 0.025,
  thigh_L: 0.045,
  thigh_R: 0.045,
  thighShaft_L: 0.045,
  thighShaft_R: 0.045,
  upperarm_L: 0.025,
  upperarm_R: 0.025,
  forearm_L: 0.025,
  forearm_R: 0.025,
  shank_L: 0.032,
  shank_R: 0.032,
};

/** Bilateral planted feet at `±stanceX` and `heelZ` on a horizontal surface `y` with `toeOutRad` outward angle. */
export function plantBothFeet(
  body: Body,
  stanceX: number,
  heelZ: number,
  toeOutRad = 0.2,
  surfaceY = 0,
  weight = 40,
): Goal[] {
  const out: Goal[] = [];
  for (const side of SIDES) {
    const s = sideSign(side);
    out.push(...plantFoot(body, side, new Vector3(s * stanceX, surfaceY, heelZ), toeOutRad, weight));
  }
  return out;
}

/** Pins sacrum, upperBack, and optionally occiput onto a tilted `PadSurface` (incline/decline/seated backrest). */
export function restBackOnPad(
  body: Body,
  back: PadSurface,
  options: {
    sacrumAlong?: number | null;
    upperBackAlong?: number;
    occiputAlong?: number | null;
    sink?: number;
    weight?: number;
  } = {},
): Goal[] {
  const {
    sacrumAlong = 0.08,
    upperBackAlong = 0.44,
    occiputAlong = 0.72,
    sink = 0.008,
    weight = 38,
  } = options;
  const origin = new Vector3(...back.origin);
  const normal = new Vector3(...back.normal);
  const goals: Goal[] = [
    restOnPlane(body, "upperBack", origin, normal, weight, sink),
    pin(body, "upperBack", () => pointOnPad(back, upperBackAlong, sink), weight * 0.4, "x"),
  ];
  if (sacrumAlong === null) {
    goals.push(restOnPlane(body, "sacrum", origin, normal, weight * 0.75, sink));
  } else {
    const sacrumPt = pointOnPad(back, sacrumAlong, sink);
    goals.push(pin(body, "sacrum", () => sacrumPt, weight));
  }
  if (occiputAlong !== null) {
    goals.push(
      restOnPlane(body, "occiput", origin, normal, weight * 0.6, sink),
      pin(body, "occiput", () => pointOnPad(back, occiputAlong, sink), weight * 0.3, "x"),
    );
  }
  return goals;
}

/** Plants the lifter's pelvis cleanly on a horizontal seat pad at `seatY`, centered at `(0, seatY, seatZ)`. */
export function sitOnSeat(
  body: Body,
  seatY: number,
  seatZ = 0,
  sink = 0.01,
  weight = 40,
): Goal[] {
  const target = new Vector3(0, seatY - sink, seatZ);
  return [pin(body, "pelvisBottom", () => target, weight)];
}

/** Keeps both hands aimed horizontally along a bar (local +Z pointing inward along -s*X). */
export function alignBarWrists(body: Body, weight = 3, sides: Side[] = SIDES): Goal[] {
  return sides.map((side) => aim(body, `wrist_${side}`, new Vector3(0, 0, 1), new Vector3(-sideSign(side), 0, 0), weight));
}

/** Plants both forefeet (toes/balls) with heels raised (for push-ups, planks, mountain climbers). */
export function plantBothToes(
  body: Body,
  stanceX: number,
  ballZ: number,
  surfaceY = 0,
  weight = 40,
): Goal[] {
  const out: Goal[] = [];
  for (const side of SIDES) {
    out.push(...plantToe(body, side, new Vector3(sideSign(side) * stanceX, surfaceY, ballZ), 0, weight));
  }
  return out;
}

/** Reusable form checks quoting catalog cues. */

export function checkFlatBack(cue: string, maxChangeDeg = 10): FormCheck {
  return {
    id: "flat-back",
    label: "Spine stays neutral",
    cue,
    evaluate: (context) =>
      everyFrame(
        context,
        (_, a) =>
          deg(
            Math.abs(a["lumbar.flex"] - context.angles[context.top]["lumbar.flex"]) +
              Math.abs(a["thoracic.flex"] - context.angles[context.top]["thoracic.flex"]),
          ),
        maxChangeDeg,
        "° of spinal flexion change",
      ),
  };
}

export function checkNeutralNeck(cue: string, maxDeg = 18): FormCheck {
  return {
    id: "neutral-neck",
    label: "Neck stays near neutral",
    cue,
    evaluate: (context) =>
      everyFrame(context, (_, a) => Math.abs(deg(a["neck.flex"])), maxDeg, "° from neutral"),
  };
}

export function checkJointRange(
  id: string,
  label: string,
  cue: string,
  angleKey: string,
  minDeltaDeg: number,
): FormCheck {
  return {
    id,
    label,
    cue,
    evaluate: ({ angles }) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const a of angles) {
        const d = deg(a[angleKey]);
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      const span = hi - lo;
      return {
        pass: span >= minDeltaDeg,
        measured: `${angleKey} moves ${span.toFixed(0)}° (${lo.toFixed(0)}° to ${hi.toFixed(0)}°)`,
      };
    },
  };
}

export function checkJointWithinAt(
  id: string,
  label: string,
  cue: string,
  angleKey: string,
  phase: "start" | "peak" | "top" | "bottom",
  loDeg: number,
  hiDeg: number,
): FormCheck {
  const isStart = phase === "start" || phase === "top";
  return {
    id,
    label,
    cue,
    evaluate: ({ angles, top, bottom }) => {
      const val = deg(angles[isStart ? top : bottom][angleKey]);
      return {
        pass: within(val, loDeg, hiDeg),
        measured: `${angleKey} is ${val.toFixed(0)}° at ${phase} (target ${loDeg}°–${hiDeg}°)`,
      };
    },
  };
}

export function checkAnchorTravel(
  id: string,
  label: string,
  cue: string,
  anchor: string,
  axis: "x" | "y" | "z",
  minTravelM: number,
): FormCheck {
  return {
    id,
    label,
    cue,
    evaluate: ({ body, frames }) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const f of frames) {
        const v = anchorPoint(body, f, anchor)[axis];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const span = hi - lo;
      return {
        pass: span >= minTravelM,
        measured: `${anchor} moves ${(span * 100).toFixed(1)} cm along ${axis.toUpperCase()}`,
      };
    },
  };
}

export function checkFeetPlanted(cue: string, sides: Side[] = SIDES, surfaceY = 0): FormCheck {
  return {
    id: "feet-planted",
    label: "Feet stay planted",
    cue,
    evaluate: (context) =>
      everyFrame(
        context,
        (frame: Frame) =>
          Math.max(
            ...sides.flatMap((side) => [
              Math.abs(anchorPoint(context.body, frame, `heel_${side}`).y - surfaceY),
              Math.abs(anchorPoint(context.body, frame, `ballIn_${side}`).y - surfaceY),
            ]),
          ) * 1000,
        12,
        " mm off surface",
      ),
  };
}
