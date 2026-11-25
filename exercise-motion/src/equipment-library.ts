import { Vector3 } from "three";
import {
  ALONG_Y,
  ALONG_Z,
  box,
  capsule,
  cylinder,
  IDENTITY,
  quatOf,
  sphere,
  type Part,
  type PropDef,
} from "./equipment";
import { rad, type Vec3 } from "./math";

/**
 * Reusable parametric gym equipment builders with pre-measured pad surfaces, pulleys, and pivot geometry.
 * Every builder rests flush on y = 0 with the lifter facing +Z by default unless noted.
 */

export interface PadSurface {
  /** A point on the pad's contact face (where the lifter's body rests). */
  origin: Vec3;
  /** Outward unit normal pointing away from the pad toward the lifter. */
  normal: Vec3;
  /** Unit vector pointing up along the pad length. */
  up: Vec3;
}

/** Evaluates a point offset `along` meters up the pad and `sink` meters into the surface. */
export function pointOnPad(surface: PadSurface, along: number, sink = 0.008, lateralX = 0): Vector3 {
  return new Vector3(
    surface.origin[0] + lateralX + surface.up[0] * along - surface.normal[0] * sink,
    surface.origin[1] + surface.up[1] * along - surface.normal[1] * sink,
    surface.origin[2] + surface.up[2] * along - surface.normal[2] * sink,
  );
}

export interface AdjustableBenchOptions {
  /** Backrest angle from horizontal in degrees: 0 = flat, 30/45/60 = incline, 80-85 = upright seated, -15..-30 = decline. */
  backAngleDeg: number;
  /** Height of the hinge point (top surface of seat where backrest meets seat). Default 0.44 m. */
  seatY?: number;
  /** Seat tilt upward toward the knees in degrees (prevents sliding forward on inclines). Default 0 for flat, 12 for incline. */
  seatTiltDeg?: number;
  /** World Z coordinate of the seat-back hinge. Default -0.05 m. */
  hingeZ?: number;
  /** Width of the pads. Default 0.29 m. */
  width?: number;
  /** Add ankle roller pads at the foot end (for decline bench / sit-ups). */
  ankleRollers?: boolean;
}

export function adjustableBench({
  backAngleDeg,
  seatY = 0.44,
  seatTiltDeg = backAngleDeg >= 15 ? 12 : 0,
  hingeZ = -0.05,
  width = 0.29,
  ankleRollers = backAngleDeg < 0,
}: AdjustableBenchOptions): {
  parts: Part[];
  seat: PadSurface;
  back: PadSurface;
} {
  const padT = 0.065;
  const seatLen = 0.36;
  const backLen = 0.84;
  const backA = rad(backAngleDeg);
  const seatA = rad(seatTiltDeg);

  // Backrest extends toward -Z (head end), angled upward by backAngleDeg from horizontal.
  const backUp: Vec3 = [0, Math.sin(backA), -Math.cos(backA)];
  const backNormal: Vec3 = [0, Math.cos(backA), Math.sin(backA)];
  const backCenter: Vec3 = [
    0,
    seatY + (backLen / 2) * backUp[1] - (padT / 2) * backNormal[1],
    hingeZ + (backLen / 2) * backUp[2] - (padT / 2) * backNormal[2],
  ];
  // Local box extends along Z (length) with top along +Y; rotating about X by +backA tilts -Z end upward.
  const backQuat = quatOf([1, 0, 0], backA);

  // Seat extends toward +Z (knee end), tilted upward by seatTiltDeg.
  const seatUp: Vec3 = [0, Math.sin(seatA), Math.cos(seatA)];
  const seatNormal: Vec3 = [0, Math.cos(seatA), -Math.sin(seatA)];
  const seatStartZ = hingeZ + 0.03;
  const seatCenter: Vec3 = [
    0,
    seatY + (seatLen / 2) * seatUp[1] - (padT / 2) * seatNormal[1],
    seatStartZ + (seatLen / 2) * seatUp[2] - (padT / 2) * seatNormal[2],
  ];
  const seatQuat = quatOf([1, 0, 0], -seatA);

  const spineZ = hingeZ - 0.12;
  const spineY = Math.max(0.22, seatY - 0.14);
  const parts: Part[] = [
    box("bench.backPad", backCenter, [width, padT, backLen], "pad", true, backQuat),
    box("bench.seatPad", seatCenter, [width, padT, seatLen], "pad", true, seatQuat),
    box("bench.spine", [0, spineY, spineZ], [0.07, 0.06, 0.96], "steel"),
    box("bench.legBack", [0, spineY / 2, spineZ - 0.4], [0.06, spineY, 0.06], "steel"),
    box("bench.legFront", [0, spineY / 2, spineZ + 0.42], [0.06, spineY, 0.06], "steel"),
    box("bench.footBack", [0, 0.025, spineZ - 0.4], [0.52, 0.05, 0.07], "steel"),
    box("bench.footFront", [0, 0.025, spineZ + 0.42], [0.38, 0.05, 0.07], "steel"),
  ];

  if (backAngleDeg > 5) {
    const strutTop: Vec3 = [
      0,
      seatY + 0.35 * backUp[1] - padT * backNormal[1],
      hingeZ + 0.35 * backUp[2] - padT * backNormal[2],
    ];
    const strutBot: Vec3 = [0, spineY, spineZ - 0.25];
    const dx = strutTop[1] - strutBot[1];
    const dz = strutTop[2] - strutBot[2];
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, -dz);
    parts.push(
      box(
        "bench.strut",
        [0, (strutTop[1] + strutBot[1]) / 2, (strutTop[2] + strutBot[2]) / 2],
        [0.04, 0.04, len],
        "chrome",
        false,
        quatOf([1, 0, 0], angle),
      ),
    );
  }

  if (ankleRollers) {
    const rollZ = seatStartZ + seatLen + 0.12;
    const rollY = seatY - 0.06;
    parts.push(
      box("bench.rollerPost", [0, (rollY + 0.12) / 2, rollZ], [0.05, rollY - 0.12, 0.05], "steel"),
      capsule("bench.rollerTop", [0, rollY + 0.08, rollZ], 0.05, 0.42, "pad"),
      capsule("bench.rollerLow", [0, rollY - 0.14, rollZ + 0.08], 0.05, 0.42, "pad"),
    );
  }

  return {
    parts,
    seat: { origin: [0, seatY, seatStartZ], normal: seatNormal, up: seatUp },
    back: { origin: [0, seatY, hingeZ], normal: backNormal, up: backUp },
  };
}

/** A 4-post commercial power rack centered at `(0, 0, zCenter)` with J-hooks, safeties, and top pull-up bar. */
export function powerRack(options: {
  zCenter?: number;
  hookY?: number;
  safetyY?: number;
  uprightX?: number;
  depth?: number;
  height?: number;
  hooksOnFront?: boolean;
} = {}): { parts: Part[]; pullUpBarY: number; pullUpBarZ: number } {
  const {
    zCenter = 0,
    hookY = 1.35,
    safetyY = 0.65,
    uprightX = 0.6,
    depth = 0.9,
    height = 2.25,
    hooksOnFront = false,
  } = options;
  const parts: Part[] = [];
  const zBack = zCenter - depth / 2;
  const zFront = zCenter + depth / 2;
  const hookZ = hooksOnFront ? zFront : zBack;
  const hookDir = hooksOnFront ? 1 : -1;

  for (const s of [1, -1]) {
    const tag = s > 0 ? "L" : "R";
    const x = s * uprightX;
    parts.push(
      box(`rack.postBack_${tag}`, [x, height / 2, zBack], [0.075, height, 0.075], "steel"),
      box(`rack.postFront_${tag}`, [x, height / 2, zFront], [0.075, height, 0.075], "steel"),
      box(`rack.base_${tag}`, [x, 0.038, zCenter], [0.075, 0.075, depth + 0.2], "steel"),
      box(`rack.top_${tag}`, [x, height - 0.038, zCenter], [0.075, 0.075, depth + 0.075], "steel", false),
      box(`rack.safety_${tag}`, [x, safetyY - 0.025, zCenter], [0.06, 0.05, depth - 0.08], "steel"),
      box(`rack.hook_${tag}`, [x, hookY - 0.015, hookZ - hookDir * 0.06], [0.06, 0.03, 0.08], "steel"),
    );
  }
  parts.push(
    box("rack.crossBackLow", [0, 0.14, zBack], [uprightX * 2, 0.06, 0.06], "steel", false),
    box("rack.crossBackTop", [0, height - 0.04, zBack], [uprightX * 2, 0.06, 0.06], "steel", false),
    cylinder("rack.pullUpBar", [0, height - 0.06, zFront], 0.016, uprightX * 2, "chrome"),
  );
  return { parts, pullUpBarY: height - 0.06, pullUpBarZ: zFront };
}

/** Pull-up / chin-up bar frame (standalone or cage front). */
export function pullUpStation(barY = 2.25, barZ = 0, width = 1.2): { parts: Part[]; barY: number } {
  const half = width / 2;
  const parts: Part[] = [
    cylinder("pullup.bar", [0, barY, barZ], 0.016, width, "chrome"),
    box("pullup.postL", [half + 0.04, barY / 2, barZ - 0.12], [0.075, barY + 0.06, 0.075], "steel"),
    box("pullup.postR", [-half - 0.04, barY / 2, barZ - 0.12], [0.075, barY + 0.06, 0.075], "steel"),
    box("pullup.armL", [half + 0.04, barY, barZ - 0.06], [0.06, 0.06, 0.18], "steel", false),
    box("pullup.armR", [-half - 0.04, barY, barZ - 0.06], [0.06, 0.06, 0.18], "steel", false),
    box("pullup.baseL", [half + 0.04, 0.035, barZ], [0.075, 0.07, 1.0], "steel"),
    box("pullup.baseR", [-half - 0.04, 0.035, barZ], [0.075, 0.07, 1.0], "steel"),
    box("pullup.cross", [0, 0.08, barZ - 0.42], [width + 0.08, 0.06, 0.06], "steel", false),
  ];
  return { parts, barY };
}

/** Parallel dip bars centered at x = 0, bar height default 1.28 m, spacing default 0.56 m. */
export function dipStation(barY = 1.28, spacing = 0.56, z = 0): { parts: Part[]; barX: number; barY: number } {
  const x = spacing / 2;
  const parts: Part[] = [];
  for (const s of [1, -1]) {
    const tag = s > 0 ? "L" : "R";
    parts.push(
      cylinder(`dip.bar_${tag}`, [s * x, barY, z], 0.02, 0.68, "chrome", ALONG_Z),
      box(`dip.post_${tag}`, [s * x, barY / 2, z - 0.34], [0.065, barY, 0.065], "steel"),
      box(`dip.base_${tag}`, [s * x, 0.035, z], [0.07, 0.07, 0.9], "steel"),
    );
  }
  parts.push(box("dip.cross", [0, 0.06, z - 0.34], [spacing + 0.07, 0.06, 0.06], "steel", false));
  return { parts, barX: x, barY };
}

/** Single adjustable cable tower at `(x, 0, z)` with pulley trolley at `pulleyY`. */
export function cableColumn(options: {
  x?: number;
  z?: number;
  pulleyY: number;
  facingDir?: 1 | -1;
  idPrefix?: string;
}): { parts: Part[]; pulley: Vec3 } {
  const { x = 0, z = 1.15, pulleyY, facingDir = -1, idPrefix = "cable" } = options;
  const h = 2.25;
  const py = Math.max(0.18, Math.min(h - 0.14, pulleyY));
  const pulleyZ = z + facingDir * 0.1;
  const stackZ = z - facingDir * 0.22;
  const parts: Part[] = [
    box(`${idPrefix}.post`, [x, h / 2, z], [0.09, h, 0.09], "steel"),
    box(`${idPrefix}.stack`, [x, 0.85, stackZ], [0.32, 1.5, 0.24], "plate", false),
    box(`${idPrefix}.shroud`, [x, 0.95, stackZ], [0.36, 1.75, 0.28], "steel", false),
    box(`${idPrefix}.base`, [x, 0.035, (z + stackZ) / 2], [0.54, 0.07, 0.62], "steel"),
    box(`${idPrefix}.top`, [x, h, (z + stackZ) / 2], [0.36, 0.07, 0.5], "steel", false),
    cylinder(`${idPrefix}.pulley`, [x, py, pulleyZ], 0.045, 0.03, "chrome"),
    box(`${idPrefix}.carriage`, [x, py, z + facingDir * 0.04], [0.11, 0.14, 0.12], "accent"),
  ];
  return { parts, pulley: [x, py, pulleyZ] };
}

/** Dual cable crossover / functional trainer with left & right columns at `±halfWidth`. */
export function cableCrossover(options: {
  pulleyY: number;
  halfWidth?: number;
  z?: number;
}): { parts: Part[]; pulleyL: Vec3; pulleyR: Vec3 } {
  const { pulleyY, halfWidth = 1.05, z = 0 } = options;
  const h = 2.28;
  const py = Math.max(0.18, Math.min(h - 0.14, pulleyY));
  const parts: Part[] = [];
  for (const s of [1, -1]) {
    const tag = s > 0 ? "L" : "R";
    const x = s * halfWidth;
    parts.push(
      box(`xover.post_${tag}`, [x, h / 2, z], [0.09, h, 0.09], "steel"),
      box(`xover.stack_${tag}`, [x + s * 0.22, 0.88, z], [0.24, 1.55, 0.34], "plate", false),
      box(`xover.base_${tag}`, [x + s * 0.12, 0.035, z], [0.55, 0.07, 0.85], "steel"),
      cylinder(`xover.pulley_${tag}`, [x - s * 0.08, py, z], 0.045, 0.03, "chrome", ALONG_Z),
      box(`xover.carriage_${tag}`, [x - s * 0.03, py, z], [0.11, 0.14, 0.11], "accent"),
    );
  }
  parts.push(box("xover.bridge", [0, h, z], [halfWidth * 2 + 0.5, 0.08, 0.09], "steel", false));
  return {
    parts,
    pulleyL: [halfWidth - 0.08, py, z],
    pulleyR: [-(halfWidth - 0.08), py, z],
  };
}

/** Lat pulldown station: seat at `seatY`, thigh roller pad, overhead boom pulley at `(0, 2.18, pulleyZ)`. */
export function latPulldownMachine(options: {
  seatY?: number;
  thighPadY?: number;
  pulleyZ?: number;
  columnZ?: number;
} = {}): { parts: Part[]; pulley: Vec3; seatY: number; thighPadY: number } {
  const { seatY = 0.43, thighPadY = 0.61, pulleyZ = 0.14, columnZ = 1.05 } = options;
  const col = cableColumn({ x: 0, z: columnZ, pulleyY: 2.16, facingDir: -1, idPrefix: "lat" });
  const boomLen = columnZ - pulleyZ + 0.14;
  const parts: Part[] = [
    ...col.parts,
    box("lat.beamTop", [0, 2.24, (pulleyZ + columnZ) / 2], [0.09, 0.09, boomLen], "steel", false),
    cylinder("lat.topPulley", [0, 2.18, pulleyZ], 0.05, 0.03, "chrome"),
    box("lat.seatPad", [0, seatY - 0.035, -0.02], [0.34, 0.07, 0.42], "pad"),
    box("lat.seatPost", [0, (seatY - 0.07) / 2, -0.02], [0.07, seatY - 0.07, 0.07], "steel"),
    box("lat.spine", [0, 0.03, columnZ / 2], [0.08, 0.06, columnZ + 0.3], "steel", false),
    box("lat.thighPost", [0, thighPadY / 2, 0.62], [0.06, thighPadY, 0.06], "steel", false),
    box("lat.thighArm", [0, thighPadY, 0.44], [0.05, 0.05, 0.36], "steel", false),
    capsule("lat.thighPad", [0, thighPadY, 0.24], 0.055, 0.44, "pad"),
  ];
  return { parts, pulley: [0, 2.18, pulleyZ], seatY, thighPadY };
}

/** Seated cable row station: long bench + angled footplates + low pulley at `(0, pulleyY, pulleyZ)`. */
export function seatedRowMachine(options: {
  seatY?: number;
  pulleyY?: number;
  pulleyZ?: number;
} = {}): { parts: Part[]; pulley: Vec3; seatY: number; footZ: number } {
  const { seatY = 0.43, pulleyY = 0.56, pulleyZ = 1.25 } = options;
  const col = cableColumn({ x: 0, z: pulleyZ + 0.14, pulleyY, facingDir: -1, idPrefix: "row" });
  const footZ = pulleyZ - 0.18;
  const parts: Part[] = [
    ...col.parts,
    box("row.seatPad", [0, seatY - 0.035, -0.05], [0.3, 0.07, 0.9], "pad"),
    box("row.seatLegBack", [0, (seatY - 0.07) / 2, -0.4], [0.07, seatY - 0.07, 0.07], "steel"),
    box("row.seatLegFront", [0, (seatY - 0.07) / 2, 0.3], [0.07, seatY - 0.07, 0.07], "steel"),
    box("row.rail", [0, 0.04, 0.45], [0.1, 0.08, 1.85], "steel"),
    box("row.footPlateL", [0.16, 0.34, footZ], [0.18, 0.32, 0.04], "steel", true, quatOf([1, 0, 0], rad(-18))),
    box("row.footPlateR", [-0.16, 0.34, footZ], [0.18, 0.32, 0.04], "steel", true, quatOf([1, 0, 0], rad(-18))),
  ];
  return { parts, pulley: col.pulley, seatY, footZ };
}

/** Preacher curl bench: seat + 45° angled arm support pad facing the lifter (+Z). */
export function preacherBench(options: {
  seatY?: number;
  padTopY?: number;
  padTopZ?: number;
} = {}): { parts: Part[]; seatY: number; armPad: PadSurface } {
  const { seatY = 0.44, padTopY = 0.92, padTopZ = 0.24 } = options;
  const angle = rad(45);
  const padLen = 0.42;
  // Pad slopes down and forward (+Z) away from the lifter's armpits.
  const up: Vec3 = [0, Math.sin(angle), -Math.cos(angle)];
  const normal: Vec3 = [0, Math.cos(angle), Math.sin(angle)];
  const padT = 0.06;
  const center: Vec3 = [
    0,
    padTopY - (padLen / 2) * up[1] - (padT / 2) * normal[1],
    padTopZ - (padLen / 2) * up[2] - (padT / 2) * normal[2],
  ];
  const parts: Part[] = [
    box("preacher.seat", [0, seatY - 0.035, -0.05], [0.34, 0.07, 0.34], "pad"),
    box("preacher.seatPost", [0, (seatY - 0.07) / 2, -0.05], [0.07, seatY - 0.07, 0.07], "steel"),
    box("preacher.armPad", center, [0.58, padT, padLen], "pad", true, quatOf([1, 0, 0], angle)),
    box("preacher.padPost", [0, (center[1] - 0.06) / 2, center[2]], [0.07, center[1] - 0.06, 0.07], "steel"),
    box("preacher.base", [0, 0.035, 0.16], [0.64, 0.07, 0.95], "steel"),
    box("preacher.barCatchL", [0.24, 0.56, 0.46], [0.05, 0.05, 0.1], "steel", false),
    box("preacher.barCatchR", [-0.24, 0.56, 0.46], [0.05, 0.05, 0.1], "steel", false),
  ];
  return {
    parts,
    seatY,
    armPad: { origin: [0, padTopY, padTopZ], normal, up },
  };
}

/** Seated selectorized / plate-loaded upper-body machine frame (chest press, shoulder press, pec deck, row, lateral raise). */
export function seatedMachineFrame(options: {
  seatY?: number;
  backAngleDeg?: number;
  backZ?: number;
  chestPadZ?: number;
  chestPadY?: number;
  stackZ?: number;
  idPrefix?: string;
} = {}): { parts: Part[]; seatY: number; back?: PadSurface } {
  const {
    seatY = 0.43,
    backAngleDeg = 85,
    backZ = -0.18,
    chestPadZ,
    chestPadY = 0.94,
    stackZ = -0.68,
    idPrefix = "machine",
  } = options;
  const parts: Part[] = [
    box(`${idPrefix}.seat`, [0, seatY - 0.035, 0], [0.36, 0.07, 0.4], "pad"),
    box(`${idPrefix}.seatPost`, [0, (seatY - 0.07) / 2, 0], [0.07, seatY - 0.07, 0.07], "steel"),
    box(`${idPrefix}.base`, [0, 0.035, stackZ / 2], [0.76, 0.07, Math.abs(stackZ) + 0.72], "steel"),
    box(`${idPrefix}.stack`, [0, 0.82, stackZ], [0.36, 1.45, 0.26], "plate", false),
    box(`${idPrefix}.tower`, [0, 0.95, stackZ], [0.46, 1.82, 0.34], "steel", false),
  ];

  let back: PadSurface | undefined;
  if (chestPadZ !== undefined) {
    parts.push(
      box(`${idPrefix}.chestPad`, [0, chestPadY, chestPadZ], [0.28, 0.36, 0.07], "pad"),
      box(`${idPrefix}.chestPost`, [0, (chestPadY - 0.18) / 2, chestPadZ + 0.05], [0.06, chestPadY - 0.18, 0.06], "steel"),
    );
  } else {
    const a = rad(backAngleDeg);
    const up: Vec3 = [0, Math.sin(a), -Math.cos(a)];
    const normal: Vec3 = [0, Math.cos(a), Math.sin(a)];
    const len = 0.72;
    const padT = 0.07;
    const center: Vec3 = [
      0,
      seatY + 0.04 + (len / 2) * up[1] - (padT / 2) * normal[1],
      backZ + (len / 2) * up[2] - (padT / 2) * normal[2],
    ];
    parts.push(
      box(`${idPrefix}.backPad`, center, [0.32, padT, len], "pad", true, quatOf([1, 0, 0], a)),
      box(`${idPrefix}.backPost`, [0, (center[1] - 0.1) / 2, backZ - 0.06], [0.07, center[1] + 0.18, 0.07], "steel", false),
    );
    back = { origin: [0, seatY + 0.04, backZ], normal, up };
  }
  return { parts, seatY, back };
}

/** 45° Leg Press frame (static sled rails + angled backrest + seat; sled itself is a moving `parts` PropDef). */
export function legPressFrame(options: { angleDeg?: number } = {}): {
  parts: Part[];
  seat: PadSurface;
  back: PadSurface;
  railDir: Vec3;
} {
  const angle = rad(options.angleDeg ?? 45);
  const backAngle = rad(38);
  const seatY = 0.42;
  const hingeZ = -0.1;
  const backUp: Vec3 = [0, Math.sin(backAngle), -Math.cos(backAngle)];
  const backNormal: Vec3 = [0, Math.cos(backAngle), Math.sin(backAngle)];
  const backLen = 0.82;
  const padT = 0.07;
  const backCenter: Vec3 = [
    0,
    seatY + (backLen / 2) * backUp[1] - (padT / 2) * backNormal[1],
    hingeZ + (backLen / 2) * backUp[2] - (padT / 2) * backNormal[2],
  ];
  const railDir: Vec3 = [0, Math.sin(angle), Math.cos(angle)];
  const parts: Part[] = [
    box("legpress.base", [0, 0.04, 0.2], [0.92, 0.08, 1.9], "steel"),
    box("legpress.seatPad", [0, seatY - 0.035, hingeZ + 0.16], [0.38, 0.07, 0.32], "pad"),
    box("legpress.backPad", backCenter, [0.38, padT, backLen], "pad", true, quatOf([1, 0, 0], backAngle)),
    box("legpress.railL", [0.42, 0.85, 0.58], [0.06, 0.06, 1.5], "chrome", false, quatOf([1, 0, 0], -angle)),
    box("legpress.railR", [-0.42, 0.85, 0.58], [0.06, 0.06, 1.5], "chrome", false, quatOf([1, 0, 0], -angle)),
    box("legpress.postFrontL", [0.42, 0.72, 1.1], [0.07, 1.44, 0.07], "steel", false),
    box("legpress.postFrontR", [-0.42, 0.72, 1.1], [0.07, 1.44, 0.07], "steel", false),
    cylinder("legpress.handleL", [0.32, seatY + 0.02, hingeZ + 0.14], 0.016, 0.28, "chrome", ALONG_Z),
    cylinder("legpress.handleR", [-0.32, seatY + 0.02, hingeZ + 0.14], 0.016, 0.28, "chrome", ALONG_Z),
  ];
  return {
    parts,
    seat: { origin: [0, seatY, hingeZ], normal: [0, 1, 0], up: [0, 0, 1] },
    back: { origin: [0, seatY, hingeZ], normal: backNormal, up: backUp },
    railDir,
  };
}

/** 45° Roman chair / back extension bench with hip pad + footplate + ankle rollers. */
export function romanChair(options: { padY?: number; angleDeg?: number } = {}): {
  parts: Part[];
  padY: number;
  footY: number;
  footZ: number;
} {
  const { padY = 0.86, angleDeg = 45 } = options;
  const a = rad(angleDeg);
  const footY = 0.16;
  const footZ = -0.68;
  const parts: Part[] = [
    box("roman.base", [0, 0.035, -0.24], [0.68, 0.07, 1.12], "steel"),
    box("roman.beam", [0, 0.48, -0.34], [0.07, 0.07, 0.96], "steel", false, quatOf([1, 0, 0], -a)),
    box("roman.hipPadL", [0.12, padY, 0], [0.18, 0.24, 0.08], "pad", true, quatOf([1, 0, 0], rad(45))),
    box("roman.hipPadR", [-0.12, padY, 0], [0.18, 0.24, 0.08], "pad", true, quatOf([1, 0, 0], rad(45))),
    box("roman.footPlate", [0, footY, footZ], [0.54, 0.04, 0.24], "steel", true, quatOf([1, 0, 0], rad(-45))),
    capsule("roman.ankleRoller", [0, footY + 0.14, footZ + 0.14], 0.055, 0.44, "pad"),
  ];
  return { parts, padY, footY, footZ };
}

/** Box / aerobic step / plyo box / elevated block resting on y = 0. */
export function platformBox(
  id: string,
  pos: Vec3,
  width: number,
  height: number,
  depth: number,
  material: "wood" | "rubber" | "pad" | "steel" = "rubber",
): Part[] {
  return [box(id, [pos[0], height / 2, pos[2]], [width, height, depth], material)];
}

/** Floor exercise mat (thin non-colliding visual surface resting on y = 0). */
export function exerciseMat(width = 0.7, length = 1.9, z = 0): Part[] {
  return [box("mat.surface", [0, 0.008, z], [width, 0.016, length], "pad", false)];
}

/** Stability ball resting on y = 0 at `(x, radius, z)`. */
export function stabilityBall(radius = 0.3, pos: [number, number] = [0, 0]): Part[] {
  return [sphere("ball.body", [pos[0], radius, pos[1]], radius, "accent")];
}

/** Cable handle / bar / rope / cuff PropDef builders (handle centered at origin along local X). */
export function cableAttachmentProp(
  id: string,
  style: "d-handle" | "straight-bar" | "lat-bar" | "v-bar" | "rope" | "ankle-cuff",
  width = 0.14,
): PropDef {
  if (style === "d-handle") {
    return {
      id,
      kind: "parts",
      parts: [
        cylinder(`${id}.grip`, [0, 0, 0], 0.015, 0.13, "chrome"),
        box(`${id}.sideL`, [0.065, 0.05, 0], [0.014, 0.1, 0.02], "steel", false),
        box(`${id}.sideR`, [-0.065, 0.05, 0], [0.014, 0.1, 0.02], "steel", false),
        box(`${id}.top`, [0, 0.1, 0], [0.14, 0.016, 0.02], "steel", false),
      ],
    };
  }
  if (style === "lat-bar") {
    const w = Math.max(0.85, width);
    return {
      id,
      kind: "parts",
      parts: [
        cylinder(`${id}.bar`, [0, 0, 0], 0.015, w, "chrome"),
        cylinder(`${id}.tipL`, [w / 2 + 0.08, -0.04, 0], 0.015, 0.18, "rubber", quatOf([0, 0, 1], rad(-26))),
        cylinder(`${id}.tipR`, [-(w / 2 + 0.08), -0.04, 0], 0.015, 0.18, "rubber", quatOf([0, 0, 1], rad(26))),
      ],
    };
  }
  if (style === "v-bar") {
    return {
      id,
      kind: "parts",
      parts: [
        cylinder(`${id}.handleL`, [0.08, 0, 0], 0.015, 0.14, "chrome", ALONG_Y),
        cylinder(`${id}.handleR`, [-0.08, 0, 0], 0.015, 0.14, "chrome", ALONG_Y),
        box(`${id}.bridge`, [0, 0, 0.08], [0.18, 0.03, 0.03], "steel", false),
      ],
    };
  }
  if (style === "rope") {
    return {
      id,
      kind: "parts",
      parts: [
        cylinder(`${id}.grip`, [0, 0, 0], 0.018, Math.max(0.14, width), "rubber"),
        sphere(`${id}.stopper`, [0, -0.04, 0], 0.032, "plate"),
      ],
    };
  }
  if (style === "ankle-cuff") {
    return {
      id,
      kind: "parts",
      parts: [cylinder(`${id}.cuff`, [0, 0, 0], 0.055, 0.08, "pad", ALONG_Y)],
    };
  }
  return {
    id,
    kind: "parts",
    parts: [cylinder(`${id}.bar`, [0, 0, 0], 0.015, Math.max(0.42, width), "chrome")],
  };
}

/** Moving machine roller pad PropDef (for leg extension, leg curl, calf raise, hip abductor/adductor). */
export function rollerPadProp(id: string, width = 0.44, radius = 0.055): PropDef {
  return {
    id,
    kind: "parts",
    parts: [
      capsule(`${id}.pad`, [0, 0, 0], radius, width, "pad"),
      cylinder(`${id}.core`, [0, 0, 0], 0.02, width + 0.08, "chrome", IDENTITY, false),
    ],
  };
}

/** Moving machine press/pull handle PropDef (for chest press, shoulder press, row, pulldown lever arm). */
export function machineHandleProp(id: string, orientation: "horizontal" | "neutral" = "horizontal", length = 0.18): PropDef {
  const quat = orientation === "neutral" ? ALONG_Y : IDENTITY;
  return {
    id,
    kind: "parts",
    parts: [
      cylinder(`${id}.grip`, [0, 0, 0], 0.017, length, "rubber", quat),
      box(`${id}.arm`, [0, 0, -0.14], [0.045, 0.045, 0.28], "steel", false),
    ],
  };
}

/** Moving sled / footplate PropDef (for 45° / horizontal leg press, hack squat). */
export function legPressSledProp(id = "sled", angleDeg = 45): PropDef {
  const q = quatOf([1, 0, 0], rad(-angleDeg));
  return {
    id,
    kind: "parts",
    parts: [
      box(`${id}.plate`, [0, 0, 0], [0.64, 0.46, 0.05], "steel", true, q),
      cylinder(`${id}.hornL`, [0.46, 0, 0.12], 0.025, 0.3, "chrome", IDENTITY, false),
      cylinder(`${id}.hornR`, [-0.46, 0, 0.12], 0.025, 0.3, "chrome", IDENTITY, false),
      cylinder(`${id}.wtL`, [0.44, 0, 0.12], 0.2, 0.08, "plate", IDENTITY, false),
      cylinder(`${id}.wtR`, [-0.44, 0, 0.12], 0.2, 0.08, "plate", IDENTITY, false),
    ],
  };
}

/** Standard bar PropDef factories. */
export const olympicBar = (id = "bar"): PropDef => ({
  id,
  kind: "barbell",
  barKg: 20,
  collarX: 0.655,
  length: 2.2,
});

export const ezBar = (id = "bar"): PropDef => ({
  id,
  kind: "barbell",
  barKg: 10,
  collarX: 0.42,
  length: 1.25,
  style: "ez",
});

export const trapBar = (id = "bar"): PropDef => ({
  id,
  kind: "barbell",
  barKg: 25,
  collarX: 0.46,
  length: 1.85,
  style: "trap",
});

export const safetySquatBar = (id = "bar"): PropDef => ({
  id,
  kind: "barbell",
  barKg: 25,
  collarX: 0.68,
  length: 2.25,
  style: "ssb",
});

export const axleBar = (id = "bar"): PropDef => ({
  id,
  kind: "barbell",
  barKg: 15,
  collarX: 0.655,
  length: 2.15,
  radius: 0.025,
  style: "axle",
});

/** Seated leg extension / seated leg curl machine frame (pivoting roller pad is a moving PropDef). */
export function legExtensionMachine(options: {
  seatY?: number;
  backAngleDeg?: number;
  thighRollerY?: number;
} = {}): {
  parts: Part[];
  seatY: number;
  back: PadSurface;
  pivot: Vec3;
  handleL: Vec3;
  handleR: Vec3;
} {
  const { seatY = 0.56, backAngleDeg = 78, thighRollerY } = options;
  const seatZ = 0;
  const backZ = -0.22;
  const a = rad(backAngleDeg);
  const up: Vec3 = [0, Math.sin(a), -Math.cos(a)];
  const normal: Vec3 = [0, Math.cos(a), Math.sin(a)];
  const backLen = 0.66;
  const padT = 0.07;
  const backCenter: Vec3 = [
    0,
    seatY + 0.04 + (backLen / 2) * up[1] - (padT / 2) * normal[1],
    backZ + (backLen / 2) * up[2] - (padT / 2) * normal[2],
  ];
  const pivot: Vec3 = [0, seatY - 0.04, 0.24];
  const handleL: Vec3 = [0.27, seatY - 0.02, 0.08];
  const handleR: Vec3 = [-0.27, seatY - 0.02, 0.08];
  const parts: Part[] = [
    box("legext.seat", [0, seatY - 0.035, seatZ], [0.42, 0.07, 0.48], "pad"),
    box("legext.backPad", backCenter, [0.36, padT, backLen], "pad", true, quatOf([1, 0, 0], a)),
    box("legext.base", [0, 0.035, -0.15], [0.78, 0.07, 1.35], "steel"),
    box("legext.seatPost", [0, (seatY - 0.07) / 2, seatZ], [0.08, seatY - 0.07, 0.08], "steel"),
    box("legext.tower", [0.55, 0.85, -0.35], [0.38, 1.65, 0.3], "steel", false),
    box("legext.stack", [0.55, 0.78, -0.35], [0.32, 1.35, 0.24], "plate", false),
    cylinder("legext.handleL", handleL, 0.016, 0.26, "chrome", ALONG_Z),
    cylinder("legext.handleR", handleR, 0.016, 0.26, "chrome", ALONG_Z),
    cylinder("legext.pivotHub", [0.24, pivot[1], pivot[2]], 0.055, 0.08, "chrome", IDENTITY, false),
  ];
  if (thighRollerY !== undefined) {
    parts.push(capsule("legext.thighRoller", [0, thighRollerY, 0.14], 0.055, 0.44, "pad"));
  }
  return {
    parts,
    seatY,
    back: { origin: [0, seatY + 0.04, backZ], normal, up },
    pivot,
    handleL,
    handleR,
  };
}

/** Lying (prone) hamstring curl bench (gentle V-angle pad + front handles + weight stack). */
export function lyingLegCurlMachine(options: { hipY?: number } = {}): {
  parts: Part[];
  hipY: number;
  pivot: Vec3;
} {
  const hipY = options.hipY ?? 0.66;
  const parts: Part[] = [
    box("legcurl.chestPad", [0, hipY - 0.07, 0.36], [0.38, 0.07, 0.72], "pad", true, quatOf([1, 0, 0], rad(10))),
    box("legcurl.thighPad", [0, hipY - 0.05, -0.22], [0.38, 0.07, 0.5], "pad", true, quatOf([1, 0, 0], rad(-8))),
    box("legcurl.base", [0, 0.035, 0.0], [0.76, 0.07, 1.7], "steel"),
    box("legcurl.postFront", [0, (hipY - 0.1) / 2, 0.52], [0.08, hipY - 0.1, 0.08], "steel"),
    box("legcurl.postBack", [0, (hipY - 0.1) / 2, -0.32], [0.08, hipY - 0.1, 0.08], "steel"),
    cylinder("legcurl.handleL", [0.24, hipY - 0.16, 0.72], 0.016, 0.22, "chrome", ALONG_Y),
    cylinder("legcurl.handleR", [-0.24, hipY - 0.16, 0.72], 0.016, 0.22, "chrome", ALONG_Y),
    box("legcurl.tower", [0.56, 0.82, -0.42], [0.36, 1.55, 0.3], "steel", false),
    box("legcurl.stack", [0.56, 0.76, -0.42], [0.3, 1.3, 0.24], "plate", false),
  ];
  return { parts, hipY, pivot: [0, hipY - 0.08, -0.48] };
}

/** 45° Hack squat / V-squat frame (angled back carriage + footplate; carriage moves as a PropDef or rails). */
export function hackSquatMachine(options: { angleDeg?: number } = {}): {
  parts: Part[];
  railDir: Vec3;
  footOrigin: Vec3;
} {
  const angle = rad(options.angleDeg ?? 45);
  const railDir: Vec3 = [0, Math.sin(angle), -Math.cos(angle)];
  const footOrigin: Vec3 = [0, 0.18, 0.56];
  const parts: Part[] = [
    box("hack.base", [0, 0.04, 0.0], [0.95, 0.08, 1.95], "steel"),
    box("hack.footPlate", footOrigin, [0.68, 0.05, 0.56], "steel", true, quatOf([1, 0, 0], rad(22))),
    box("hack.railL", [0.38, 0.96, -0.15], [0.06, 0.06, 1.95], "chrome", false, quatOf([1, 0, 0], angle)),
    box("hack.railR", [-0.38, 0.96, -0.15], [0.06, 0.06, 1.95], "chrome", false, quatOf([1, 0, 0], angle)),
    box("hack.backPostL", [0.38, 0.85, -0.82], [0.08, 1.7, 0.08], "steel", false),
    box("hack.backPostR", [-0.38, 0.85, -0.82], [0.08, 1.7, 0.08], "steel", false),
  ];
  return { parts, railDir, footOrigin };
}

/** Glute Ham Developer (GHD): dual rounded hip/thigh pads + rear footplate + twin ankle rollers. */
export function ghdBench(options: { padY?: number } = {}): {
  parts: Part[];
  padY: number;
  footZ: number;
} {
  const padY = options.padY ?? 0.96;
  const footZ = -0.82;
  const parts: Part[] = [
    box("ghd.base", [0, 0.035, -0.32], [0.76, 0.07, 1.65], "steel"),
    box("ghd.postFront", [0, padY / 2, 0.12], [0.08, padY - 0.1, 0.08], "steel"),
    box("ghd.postBack", [0, 0.42, footZ], [0.08, 0.84, 0.08], "steel"),
    capsule("ghd.padL", [0.14, padY - 0.11, 0.12], 0.11, 0.2, "pad", ALONG_Z),
    capsule("ghd.padR", [-0.14, padY - 0.11, 0.12], 0.11, 0.2, "pad", ALONG_Z),
    box("ghd.footPlate", [0, 0.66, footZ], [0.56, 0.42, 0.04], "steel"),
    capsule("ghd.rollerTop", [0, 0.78, footZ + 0.16], 0.055, 0.46, "pad"),
    capsule("ghd.rollerBot", [0, 0.56, footZ + 0.16], 0.055, 0.46, "pad"),
  ];
  return { parts, padY, footZ };
}

/** Bulgarian split squat rear-foot roller stand. */
export function splitSquatStand(rollerY = 0.44, rollerZ = -0.68): { parts: Part[]; rollerY: number } {
  return {
    parts: [
      capsule("splitstand.roller", [0, rollerY, rollerZ], 0.055, 0.44, "pad"),
      box("splitstand.postL", [0.26, rollerY / 2, rollerZ], [0.05, rollerY + 0.08, 0.05], "steel"),
      box("splitstand.postR", [-0.26, rollerY / 2, rollerZ], [0.05, rollerY + 0.08, 0.05], "steel"),
      box("splitstand.baseL", [0.26, 0.025, rollerZ], [0.06, 0.05, 0.52], "steel"),
      box("splitstand.baseR", [-0.26, 0.025, rollerZ], [0.06, 0.05, 0.52], "steel"),
    ],
    rollerY,
  };
}

/** Standing or seated calf raise station. */
export function calfRaiseStation(options: { mode: "standing" | "seated"; blockY?: number; seatY?: number }): {
  parts: Part[];
  blockY: number;
} {
  const blockY = options.blockY ?? 0.14;
  const parts: Part[] = [
    box("calf.block", [0, blockY / 2, 0.14], [0.52, blockY, 0.16], "steel"),
    box("calf.base", [0, 0.03, -0.15], [0.68, 0.06, 1.15], "steel"),
  ];
  if (options.mode === "seated") {
    const sy = options.seatY ?? 0.48;
    parts.push(
      box("calf.seat", [0, sy - 0.035, -0.34], [0.34, 0.07, 0.36], "pad"),
      box("calf.seatPost", [0, (sy - 0.07) / 2, -0.34], [0.07, sy - 0.07, 0.07], "steel"),
    );
  } else {
    parts.push(
      box("calf.tower", [0, 0.96, -0.45], [0.56, 1.92, 0.34], "steel", false),
      box("calf.stack", [0, 0.85, -0.45], [0.36, 1.45, 0.24], "plate", false),
    );
  }
  return { parts, blockY };
}

/** Landmine pivot sleeve resting on the floor at `(0, 0.05, pivotZ)`. */
export function landmineBase(pivotZ = 1.65): { parts: Part[]; pivot: Vec3 } {
  return {
    parts: [
      box("landmine.plate", [0, 0.025, pivotZ], [0.46, 0.05, 0.46], "plate"),
      cylinder("landmine.sleeve", [0, 0.08, pivotZ], 0.032, 0.24, "steel", ALONG_Z, false),
    ],
    pivot: [0, 0.06, pivotZ],
  };
}

/** Ab wheel prop (center handle at origin along local X + center wheel). */
export function abWheelProp(id = "abwheel"): PropDef {
  return {
    id,
    kind: "parts",
    parts: [
      cylinder(`${id}.handle`, [0, 0, 0], 0.016, 0.34, "rubber"),
      cylinder(`${id}.wheel`, [0, 0, 0], 0.095, 0.05, "plate"),
    ],
  };
}

/** Gymnastics ring prop (grip centered at origin along local X). */
export function gymRingProp(id: string): PropDef {
  return {
    id,
    kind: "parts",
    parts: [
      cylinder(`${id}.grip`, [0, 0, 0], 0.016, 0.14, "wood"),
      cylinder(`${id}.top`, [0, 0.18, 0], 0.014, 0.12, "wood", IDENTITY, false),
      cylinder(`${id}.sideL`, [0.08, 0.09, 0], 0.014, 0.16, "wood", ALONG_Y, false),
      cylinder(`${id}.sideR`, [-0.08, 0.09, 0], 0.014, 0.16, "wood", ALONG_Y, false),
    ],
  };
}

/** Push/pull prowler sled prop (push poles along +Y, base resting at local y = 0). */
export function prowlerSledProp(id = "sled"): PropDef {
  return {
    id,
    kind: "parts",
    parts: [
      box(`${id}.skiL`, [0.34, 0.03, 0], [0.1, 0.06, 1.05], "steel"),
      box(`${id}.skiR`, [-0.34, 0.03, 0], [0.1, 0.06, 1.05], "steel"),
      box(`${id}.deck`, [0, 0.09, 0], [0.76, 0.06, 0.72], "steel"),
      cylinder(`${id}.poleL`, [0.3, 0.56, -0.32], 0.024, 1.02, "chrome", ALONG_Y),
      cylinder(`${id}.poleR`, [-0.3, 0.56, -0.32], 0.024, 1.02, "chrome", ALONG_Y),
      cylinder(`${id}.post`, [0, 0.32, 0.04], 0.025, 0.45, "chrome", ALONG_Y, false),
      cylinder(`${id}.plates`, [0, 0.22, 0.04], 0.225, 0.16, "plate", ALONG_Y, false),
    ],
  };
}

/** Cardio frames (treadmill, bike, rower, elliptical, stair climber). */
export function cardioMachine(
  kind: "treadmill" | "bike" | "rower" | "elliptical" | "stair-climber" | "skierg",
): Part[] {
  if (kind === "treadmill") {
    return [
      box("treadmill.deck", [0, 0.08, 0], [0.78, 0.16, 1.95], "rubber"),
      box("treadmill.belt", [0, 0.165, -0.05], [0.56, 0.01, 1.6], "plate", false),
      box("treadmill.postL", [0.4, 0.68, 0.85], [0.07, 1.25, 0.08], "steel"),
      box("treadmill.postR", [-0.4, 0.68, 0.85], [0.07, 1.25, 0.08], "steel"),
      box("treadmill.console", [0, 1.28, 0.82], [0.76, 0.26, 0.24], "steel", false, quatOf([1, 0, 0], rad(-30))),
    ];
  }
  if (kind === "bike") {
    return [
      box("bike.base", [0, 0.035, 0], [0.54, 0.07, 1.22], "steel"),
      cylinder("bike.flywheel", [0, 0.42, 0.36], 0.24, 0.08, "plate", IDENTITY, false),
      box("bike.seatPost", [0, 0.48, -0.26], [0.05, 0.82, 0.05], "steel"),
      box("bike.seat", [0, 0.9, -0.26], [0.18, 0.07, 0.26], "pad"),
      box("bike.stem", [0, 0.62, 0.42], [0.05, 1.05, 0.05], "steel"),
      cylinder("bike.handlebar", [0, 1.12, 0.38], 0.018, 0.54, "rubber"),
    ];
  }
  if (kind === "rower") {
    return [
      box("rower.rail", [0, 0.28, -0.2], [0.12, 0.08, 1.55], "chrome"),
      box("rower.seat", [0, 0.35, -0.15], [0.3, 0.06, 0.24], "pad"),
      box("rower.footRest", [0, 0.28, 0.56], [0.34, 0.28, 0.06], "steel", true, quatOf([1, 0, 0], rad(-35))),
      cylinder("rower.flywheel", [0, 0.54, 0.95], 0.24, 0.14, "plate", IDENTITY, false),
      box("rower.legFront", [0, 0.15, 0.85], [0.58, 0.3, 0.06], "steel"),
      box("rower.legBack", [0, 0.14, -0.92], [0.46, 0.28, 0.06], "steel"),
    ];
  }
  if (kind === "stair-climber") {
    return [
      box("stairs.body", [0, 0.72, 0.12], [0.86, 1.44, 1.35], "steel", false),
      box("stairs.step1", [0, 0.38, -0.22], [0.56, 0.18, 0.26], "rubber"),
      box("stairs.step2", [0, 0.58, 0.02], [0.56, 0.18, 0.26], "rubber"),
      box("stairs.step3", [0, 0.78, 0.26], [0.56, 0.18, 0.26], "rubber"),
      cylinder("stairs.railL", [0.4, 1.24, 0.1], 0.02, 0.95, "chrome", ALONG_Z),
      cylinder("stairs.railR", [-0.4, 1.24, 0.1], 0.02, 0.95, "chrome", ALONG_Z),
    ];
  }
  if (kind === "skierg") {
    return [
      box("skierg.deck", [0, 0.025, 0], [0.64, 0.05, 1.25], "rubber"),
      box("skierg.column", [0, 1.08, 0.56], [0.42, 2.12, 0.16], "steel"),
      cylinder("skierg.flywheel", [0, 0.44, 0.64], 0.24, 0.14, "plate", IDENTITY, false),
      box("skierg.topArm", [0, 2.12, 0.44], [0.44, 0.08, 0.36], "steel", false),
    ];
  }
  // elliptical
  return [
    box("ellip.base", [0, 0.04, 0], [0.64, 0.08, 1.65], "steel"),
    cylinder("ellip.flywheel", [0, 0.44, 0.62], 0.24, 0.12, "plate", IDENTITY, false),
    box("ellip.post", [0, 0.72, 0.62], [0.1, 1.35, 0.1], "steel"),
    box("ellip.console", [0, 1.38, 0.56], [0.54, 0.22, 0.18], "steel", false, quatOf([1, 0, 0], rad(-25))),
  ];
}

