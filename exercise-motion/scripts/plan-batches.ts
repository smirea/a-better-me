#!/usr/bin/env bun
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogSlugMap, loadAppCatalog, MOTION_ROOT, type AppCatalogExercise } from "./catalog-io";

export interface ExerciseBatch {
  id: string;
  label: string;
  pattern: string;
  bucket: string;
  slugs: string[];
}

function equipmentBucket(ex: AppCatalogExercise): string {
  const eq = ex.resistanceEquipment?.[0] ?? "Bodyweight";
  if (/bodyweight/i.test(eq)) return "bodyweight";
  if (/barbell|ez bar|trap bar|safety squat|axle|buffalo|cambered|marrs/i.test(eq)) return "barbell";
  if (/dumbbell/i.test(eq)) return "dumbbell";
  if (/kettlebell/i.test(eq)) return "kettlebell";
  if (/cable|pulley/i.test(eq)) return "cable";
  if (/smith/i.test(eq)) return "smith";
  if (/band/i.test(eq)) return "band";
  if (/plate|sled|medicine|vest|belt|ankle|roller|gripper|harness|rope/i.test(eq) && !/plate-loaded/i.test(eq)) {
    return "free-other";
  }
  return "machine";
}

function implementedSlugs(): Set<string> {
  const dir = join(MOTION_ROOT, "src", "exercises");
  const out = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts") || file === "index.ts" || file.startsWith("_")) continue;
    out.add(file.slice(0, -3));
  }
  return out;
}

export function planBatches(maxBatchSize = 15): ExerciseBatch[] {
  const catalog = loadAppCatalog();
  const slugs = catalogSlugMap();
  const done = implementedSlugs();

  const grouped = new Map<string, { pattern: string; bucket: string; items: AppCatalogExercise[] }>();
  for (const ex of catalog) {
    const slug = slugs.get(ex.id)!;
    if (done.has(slug)) continue;
    const pattern = ex.movementPatterns?.[0] ?? "Other";
    const bucket = equipmentBucket(ex);
    const key = `${pattern}::${bucket}`;
    const entry = grouped.get(key) ?? { pattern, bucket, items: [] };
    entry.items.push(ex);
    grouped.set(key, entry);
  }

  // Sort buckets by size descending, split large buckets (>maxBatchSize) into coherent chunks,
  // and coalesce tiny singletons (<=4) sharing the same movement pattern.
  const byPatternSmall = new Map<string, { pattern: string; items: AppCatalogExercise[] }>();
  const rawBatches: { pattern: string; bucket: string; items: AppCatalogExercise[] }[] = [];

  for (const group of grouped.values()) {
    group.items.sort(
      (a, b) =>
        b.images.length - a.images.length ||
        (b.searchBoost ?? 0) - (a.searchBoost ?? 0) ||
        a.name.localeCompare(b.name),
    );
    if (group.items.length <= 4) {
      const merged = byPatternSmall.get(group.pattern) ?? { pattern: group.pattern, items: [] };
      merged.items.push(...group.items);
      byPatternSmall.set(group.pattern, merged);
    } else {
      rawBatches.push(group);
    }
  }
  for (const merged of byPatternSmall.values()) {
    rawBatches.push({ pattern: merged.pattern, bucket: "mixed", items: merged.items });
  }

  // Sort high-value popular patterns first
  rawBatches.sort(
    (a, b) =>
      b.items.filter((x) => x.images.length > 0).length -
        a.items.filter((x) => x.images.length > 0).length ||
      b.items.length - a.items.length,
  );

  const batches: ExerciseBatch[] = [];
  let seq = 1;
  for (const g of rawBatches) {
    const chunks = Math.max(1, Math.ceil(g.items.length / maxBatchSize));
    const perChunk = Math.ceil(g.items.length / chunks);
    for (let c = 0; c < chunks; c++) {
      const slice = g.items.slice(c * perChunk, (c + 1) * perChunk);
      if (slice.length === 0) continue;
      const partSuffix = chunks > 1 ? ` #${c + 1}/${chunks}` : "";
      batches.push({
        id: `batch-${String(seq++).padStart(3, "0")}`,
        label: `${g.pattern} (${g.bucket}${partSuffix})`,
        pattern: g.pattern,
        bucket: g.bucket,
        slugs: slice.map((x) => slugs.get(x.id)!),
      });
    }
  }
  return batches;
}

if (import.meta.main) {
  const maxSize = Number(process.argv[2] ?? 15);
  const batches = planBatches(maxSize);
  const total = batches.reduce((s, b) => s + b.slugs.length, 0);
  const outPath = "/tmp/motion-batches.json";
  writeFileSync(outPath, JSON.stringify(batches, null, 2));
  console.log(`Planned ${batches.length} batches covering ${total} remaining exercises (max ${maxSize}/batch) -> ${outPath}`);
  for (const b of batches.slice(0, 25)) {
    console.log(`  ${b.id} (${String(b.slugs.length).padStart(2)})  ${b.label.padEnd(46)}  ${b.slugs.slice(0, 3).join(", ")}`);
  }
}
