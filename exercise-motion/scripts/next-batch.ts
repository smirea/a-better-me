#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogSlugMap, loadAppCatalog, MOTION_ROOT } from "./catalog-io";
import { planBatches } from "./plan-batches";

/**
 * Picks the next N un-dispatched batches (excluding slugs listed in `/tmp/motion-briefs/inflight.json`),
 * registers them in `inflight.json`, writes concise brief files, and prints their dispatch manifest.
 *
 * Usage:
 *   bun exercise-motion/scripts/next-batch.ts <count=1> [maxSize=15] [--diverse]
 *   bun exercise-motion/scripts/next-batch.ts --release <slug1> <slug2>...
 */
async function main() {
  const args = process.argv.slice(2);
  const inflightPath = "/tmp/motion-briefs/inflight.json";
  mkdirSync("/tmp/motion-briefs/rolling", { recursive: true });
  const inflight = new Set<string>(
    existsSync(inflightPath) ? (JSON.parse(readFileSync(inflightPath, "utf8")) as string[]) : [],
  );

  if (args[0] === "--release") {
    for (const s of args.slice(1)) inflight.delete(s);
    writeFileSync(inflightPath, JSON.stringify([...inflight], null, 2));
    console.log(`Released ${args.length - 1} slugs (${inflight.size} still in-flight).`);
    return;
  }
  if (args[0] === "--add") {
    for (const s of args.slice(1)) inflight.add(s);
    writeFileSync(inflightPath, JSON.stringify([...inflight], null, 2));
    console.log(`Added ${args.length - 1} slugs (${inflight.size} in-flight).`);
    return;
  }

  const diverse = args.includes("--diverse");
  const nums = args.filter((a) => !a.startsWith("--"));
  const count = Number(nums[0] ?? 1);
  const maxSize = Number(nums[1] ?? 15);

  const all = planBatches(maxSize).filter((b) => b.slugs.every((s) => !inflight.has(s)));
  const picked: typeof all = [];
  const seenPattern = new Set<string>();
  for (const b of all) {
    if (diverse && seenPattern.has(b.pattern)) continue;
    seenPattern.add(b.pattern);
    picked.push(b);
    if (picked.length === count) break;
  }
  if (picked.length < count) {
    for (const b of all) {
      if (picked.includes(b)) continue;
      picked.push(b);
      if (picked.length === count) break;
    }
  }

  const catalog = loadAppCatalog();
  const slugMap = catalogSlugMap();
  const bySlug = new Map(catalog.map((e) => [slugMap.get(e.id)!, e]));
  const manifest = [];
  const stamp = Date.now().toString(36).slice(-4);

  for (let i = 0; i < picked.length; i++) {
    const b = picked[i];
    const tag = `${b.id}-${stamp}-${i + 1}`;
    const briefPath = join("/tmp/motion-briefs/rolling", `${tag}.md`);
    const proc = Bun.spawnSync([
      "bun",
      join(MOTION_ROOT, "scripts", "exercise-brief.ts"),
      "--concise",
      ...b.slugs,
    ]);
    if (proc.exitCode !== 0) {
      throw new Error(`exercise-brief failed for ${b.id}: ${proc.stderr.toString()}`);
    }
    writeFileSync(briefPath, proc.stdout);
    for (const s of b.slugs) inflight.add(s);
    manifest.push({
      tag,
      label: b.label,
      pattern: b.pattern,
      bucket: b.bucket,
      briefPath,
      count: b.slugs.length,
      slugs: b.slugs,
      noInstructions: b.slugs.filter((s) => !bySlug.get(s)?.hasInstructions),
    });
  }

  writeFileSync(inflightPath, JSON.stringify([...inflight], null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

await main();
