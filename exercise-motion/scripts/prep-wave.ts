#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogSlugMap, loadAppCatalog, MOTION_ROOT } from "./catalog-io";
import { planBatches } from "./plan-batches";

/**
 * Prepares the next N cohesive batches (default 5, max 15 exercises each),
 * writes concise brief files under `/tmp/motion-briefs/<batchId>.md`,
 * and prints a machine-readable JSON manifest for dispatching 5 concurrent Grok workers.
 */
async function main() {
  const count = Number(process.argv[2] ?? 5);
  const maxBatchSize = Number(process.argv[3] ?? 15);
  const batches = planBatches(maxBatchSize).slice(0, count);
  if (batches.length === 0) {
    console.log("ALL EXERCISES IMPLEMENTED!");
    return;
  }

  const outDir = "/tmp/motion-briefs/waves";
  mkdirSync(outDir, { recursive: true });
  const catalog = loadAppCatalog();
  const slugMap = catalogSlugMap();
  const bySlug = new Map(catalog.map((e) => [slugMap.get(e.id)!, e]));

  const manifest: {
    id: string;
    label: string;
    briefPath: string;
    slugs: string[];
    noInstructions: string[];
    noImages: string[];
  }[] = [];

  for (const b of batches) {
    const briefPath = join(outDir, `${b.id}.md`);
    const proc = Bun.spawn(
      ["bun", join(MOTION_ROOT, "scripts", "exercise-brief.ts"), "--concise", ...b.slugs],
      { stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`exercise-brief failed for ${b.id}: ${err}`);
    }
    writeFileSync(briefPath, out);
    const noInstructions = b.slugs.filter((s) => !bySlug.get(s)?.hasInstructions);
    const noImages = b.slugs.filter((s) => (bySlug.get(s)?.images.length ?? 0) === 0);
    manifest.push({
      id: b.id,
      label: b.label,
      briefPath,
      slugs: b.slugs,
      noInstructions,
      noImages,
    });
  }

  console.log(JSON.stringify(manifest, null, 2));
}

await main();
