import { ZONES, type EquipmentMeta, type ZoneId } from "./catalog";

export interface PlacedEquipment {
  meta: EquipmentMeta;
  x: number;
  z: number;
  rotY: number;
  /** World-space footprint extents after rotation. */
  footW: number;
  footD: number;
}

export interface ZoneBounds {
  id: ZoneId;
  name: string;
  shortName: string;
  accent: string;
  floor: "rubber" | "platform" | "turf" | "wood";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  count: number;
}

export interface GymPlan {
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  zones: ZoneBounds[];
  items: PlacedEquipment[];
}

interface LocalPlacement {
  meta: EquipmentMeta;
  lx: number;
  lz: number;
  rotY: number;
  footW: number;
  footD: number;
}

interface PackedZone {
  id: ZoneId;
  width: number;
  depth: number;
  items: LocalPlacement[];
}

function packZoneShelf(
  id: ZoneId,
  items: EquipmentMeta[],
  targetWidth: number,
  sideGap: number,
  rowGap: number,
): PackedZone {
  // Group cleanly by subgroup, then keep similar-depth items together so rows stay tidy.
  const sorted = [...items].sort((a, b) => {
    const sub = a.subgroup.localeCompare(b.subgroup);
    if (sub !== 0) return sub;
    const d = Math.max(b.size[0], b.size[2]) - Math.max(a.size[0], a.size[2]);
    if (Math.abs(d) > 0.35) return d;
    return a.name.localeCompare(b.name);
  });

  const rows: { items: { meta: EquipmentMeta; rotY: number; w: number; d: number }[]; width: number; depth: number }[] = [];
  let curRow: { meta: EquipmentMeta; rotY: number; w: number; d: number }[] = [];
  let curW = 0;
  let curD = 0;

  for (const meta of sorted) {
    // Orient very wide wall rigs along X so they align cleanly along aisles and perimeter walls.
    const rawW = meta.size[0];
    const rawD = meta.size[2];
    let rotY = 0;
    let w = rawW;
    let d = rawD;

    // For narrow/long machines like treadmills or benches, face forward along Z so rows align neatly.
    if (rawW > rawD * 1.8 && id !== "functional" && id !== "cables" && rawW < 3.5) {
      rotY = Math.PI / 2;
      w = rawD;
      d = rawW;
    }

    const addW = curRow.length === 0 ? w : sideGap + w;
    if (curRow.length > 0 && curW + addW > targetWidth) {
      rows.push({ items: curRow, width: curW, depth: curD });
      curRow = [{ meta, rotY, w, d }];
      curW = w;
      curD = d;
    } else {
      curRow.push({ meta, rotY, w, d });
      curW += addW;
      curD = Math.max(curD, d);
    }
  }
  if (curRow.length > 0) {
    rows.push({ items: curRow, width: curW, depth: curD });
  }

  const maxRowW = rows.reduce((m, r) => Math.max(m, r.width), 2);
  const placed: LocalPlacement[] = [];
  let z = 0;

  rows.forEach((row, rowIdx) => {
    // Center each row horizontally inside the zone bay and alternate facing so rows face shared aisles.
    let x = (maxRowW - row.width) / 2;
    const faceFlip = rowIdx % 2 === 1 ? Math.PI : 0;
    for (const entry of row.items) {
      placed.push({
        meta: entry.meta,
        lx: x + entry.w / 2,
        lz: z + row.depth / 2,
        rotY: (entry.rotY + faceFlip) % (Math.PI * 2),
        footW: entry.w,
        footD: entry.d,
      });
      x += entry.w + sideGap;
    }
    z += row.depth + (rowIdx < rows.length - 1 ? rowGap : 0);
  });

  return {
    id,
    width: maxRowW,
    depth: Math.max(2, z),
    items: placed,
  };
}

/**
 * Lay out all equipment into a two-wing commercial mega-gym:
 * - North Hall (row 1): Free Weights & Racks | Plate-Loaded | Cable Stations
 * - Middle Hall (row 2): Pin-Loaded | Pro & Smart Strength | Cardio Deck | Studio & Recovery
 * - South Arena (row 3, full-width athletic turf): Functional Rigs, Cages & Circuits
 */
export function buildGymLayout(manifest: EquipmentMeta[]): GymPlan {
  const byZone = new Map<ZoneId, EquipmentMeta[]>();
  for (const z of ZONES) byZone.set(z.id, []);
  for (const m of manifest) byZone.get(m.zone)?.push(m);

  const packed = new Map<ZoneId, PackedZone>();
  const config: Record<ZoneId, { targetW: number; sideGap: number; rowGap: number }> = {
    "free-weights": { targetW: 24, sideGap: 0.75, rowGap: 1.75 },
    "plate-loaded": { targetW: 15, sideGap: 0.9, rowGap: 1.9 },
    cables: { targetW: 16, sideGap: 1.0, rowGap: 2.0 },
    "pin-loaded": { targetW: 19, sideGap: 0.75, rowGap: 1.75 },
    "pro-strength": { targetW: 18, sideGap: 0.75, rowGap: 1.75 },
    cardio: { targetW: 13, sideGap: 0.6, rowGap: 1.6 },
    studio: { targetW: 11, sideGap: 0.7, rowGap: 1.6 },
    functional: { targetW: 58, sideGap: 1.25, rowGap: 2.4 },
  };

  for (const z of ZONES) {
    const cfg = config[z.id];
    packed.set(z.id, packZoneShelf(z.id, byZone.get(z.id) ?? [], cfg.targetW, cfg.sideGap, cfg.rowGap));
  }

  const PAD = 1.4; // inner margin inside each zone's floor bay
  const AISLE_X = 3.2; // wide north-south walkways between adjacent bays
  const AISLE_Z = 3.8; // wide east-west main concourses between wings

  const baySize = (id: ZoneId) => {
    const p = packed.get(id)!;
    return { w: p.width + PAD * 2, d: p.depth + PAD * 2 };
  };

  const bands: ZoneId[][] = [
    ["free-weights", "plate-loaded", "cables"],
    ["pin-loaded", "pro-strength", "cardio", "studio"],
    ["functional"],
  ];

  const bandWidths = bands.map((band) =>
    band.reduce((sum, id, i) => sum + baySize(id).w + (i > 0 ? AISLE_X : 0), 0),
  );
  const hallW = Math.max(...bandWidths);

  const zones: ZoneBounds[] = [];
  const items: PlacedEquipment[] = [];

  let curZ = 0;
  for (let b = 0; b < bands.length; b++) {
    const band = bands[b];
    const bandD = Math.max(...band.map((id) => baySize(id).d));
    const bandW = bandWidths[b];
    // Distribute any slack horizontally across bays so the hall perimeter stays a crisp rectangle.
    const extraPerBay = (hallW - bandW) / band.length;

    let curX = 0;
    for (const id of band) {
      const def = ZONES.find((z) => z.id === id)!;
      const p = packed.get(id)!;
      const boxW = baySize(id).w + extraPerBay;
      const boxD = bandD;

      const offsetX = curX + (boxW - p.width) / 2;
      const offsetZ = curZ + (boxD - p.depth) / 2;

      zones.push({
        id,
        name: def.name,
        shortName: def.shortName,
        accent: def.accent,
        floor: def.floor,
        minX: curX,
        maxX: curX + boxW,
        minZ: curZ,
        maxZ: curZ + boxD,
        centerX: curX + boxW / 2,
        centerZ: curZ + boxD / 2,
        count: p.items.length,
      });

      for (const lp of p.items) {
        items.push({
          meta: lp.meta,
          x: +(offsetX + lp.lx).toFixed(3),
          z: +(offsetZ + lp.lz).toFixed(3),
          rotY: lp.rotY,
          footW: lp.footW,
          footD: lp.footD,
        });
      }
      curX += boxW + AISLE_X;
    }

    curZ += bandD + (b < bands.length - 1 ? AISLE_Z : 0);
  }

  // Center the entire hall around (0, 0) for clean camera coordinates.
  const wallMargin = 2.6;
  const totalW = hallW + wallMargin * 2;
  const totalD = curZ + wallMargin * 2;
  const shiftX = -hallW / 2;
  const shiftZ = -curZ / 2;

  for (const z of zones) {
    z.minX = +(z.minX + shiftX).toFixed(3);
    z.maxX = +(z.maxX + shiftX).toFixed(3);
    z.minZ = +(z.minZ + shiftZ).toFixed(3);
    z.maxZ = +(z.maxZ + shiftZ).toFixed(3);
    z.centerX = +(z.centerX + shiftX).toFixed(3);
    z.centerZ = +(z.centerZ + shiftZ).toFixed(3);
  }
  for (const it of items) {
    it.x = +(it.x + shiftX).toFixed(3);
    it.z = +(it.z + shiftZ).toFixed(3);
  }

  return {
    width: +totalW.toFixed(2),
    depth: +totalD.toFixed(2),
    minX: +(-totalW / 2).toFixed(2),
    maxX: +(totalW / 2).toFixed(2),
    minZ: +(-totalD / 2).toFixed(2),
    maxZ: +(totalD / 2).toFixed(2),
    zones,
    items,
  };
}

/** Verify no two placed equipment bounding boxes overlap on the gym floor. */
export function findLayoutOverlaps(plan: GymPlan): [string, string][] {
  const overlaps: [string, string][] = [];
  const eps = 0.02;
  for (let i = 0; i < plan.items.length; i++) {
    const a = plan.items[i];
    for (let j = i + 1; j < plan.items.length; j++) {
      const b = plan.items[j];
      const dx = Math.abs(a.x - b.x);
      const dz = Math.abs(a.z - b.z);
      if (dx < (a.footW + b.footW) / 2 - eps && dz < (a.footD + b.footD) / 2 - eps) {
        overlaps.push([a.meta.id, b.meta.id]);
      }
    }
  }
  return overlaps;
}
