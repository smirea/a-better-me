#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import {
  catalogSlugMap,
  exerciseImageFiles,
  loadAppCatalog,
  MOTION_ROOT,
  readInstructionMarkdown,
  type AppCatalogExercise,
} from "./catalog-io";

async function toPng(webpPath: string, outDir: string): Promise<string> {
  mkdirSync(outDir, { recursive: true });
  const pngPath = join(outDir, `${basename(webpPath, ".webp")}.png`);
  if (!existsSync(pngPath)) {
    const proc = Bun.spawn(["magick", webpPath, pngPath], { stderr: "pipe" });
    const code = await proc.exited;
    if (code !== 0) return webpPath;
  }
  return pngPath;
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

async function formatBrief(ex: AppCatalogExercise, slug: string, imgDir: string): Promise<string> {
  const md = readInstructionMarkdown(ex.id);
  const webps = exerciseImageFiles(ex);
  const pngs = await Promise.all(webps.map((p) => toPng(p, imgDir)));
  const lines: string[] = [
    `# ${ex.name}`,
    "",
    `- **File to create:** \`exercise-motion/src/exercises/${slug}.ts\``,
    `- **Exercise \`id\`:** \`${slug}\``,
    `- **\`catalogId\`:** \`${ex.id}\``,
    `- **Category / Type / Region / Laterality:** ${ex.category} / ${ex.type} / ${ex.region ?? "n/a"} / ${ex.laterality}`,
    `- **Movement pattern(s):** ${ex.movementPatterns.join(", ") || "none"}`,
    `- **Metrics:** ${ex.metrics.join(", ") || "reps"}`,
    `- **Bodyweight fraction:** ${ex.bodyweightFraction}`,
    `- **Primary muscles:** ${ex.primaryMuscles.join(", ") || "none"} (${ex.primaryMuscleDetails.join(", ") || "n/a"})`,
    `- **Secondary muscles:** ${ex.secondaryMuscles.join(", ") || "none"}`,
    `- **Stretched muscles:** ${ex.selection?.stretchedMuscles?.join(", ") || "none"}`,
    `- **Primary joint actions:** ${ex.primaryJointActions.join(", ") || "none"}`,
    `- **Secondary joint actions:** ${ex.secondaryJointActions.join(", ") || "none"}`,
    `- **Resistance equipment options:** ${ex.resistanceEquipment.join(" | ") || "Bodyweight only"}`,
    `- **Support equipment options:** ${ex.supportEquipment.join(" | ") || "None"}`,
  ];
  if (ex.alternativeNames.length) {
    lines.push(`- **Alternative names:** ${ex.alternativeNames.join(", ")}`);
  }
  if (pngs.length) {
    lines.push(`- **Reference images (INSPECT THESE FIRST):**`);
    pngs.forEach((p, idx) => lines.push(`  - Frame ${idx + 1}: \`${p}\` (original: \`${webps[idx]}\`)`));
  } else {
    lines.push(`- **Reference images:** NONE bundled (rely on instructions and double-check online if needed)`);
  }
  lines.push("");
  if (md) {
    lines.push("## Catalog Instructions", "", md, "");
  } else {
    lines.push(
      "## Catalog Instructions",
      "",
      "**NO BUNDLED INSTRUCTIONS.** Look up standard exercise form, equipment setup, grip/stance, and joint motion online before implementing, and write clear form checks quoting standard biomechanical cues.",
      "",
    );
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const catalog = loadAppCatalog();
  const slugMap = catalogSlugMap();
  const bySlug = new Map<string, AppCatalogExercise>();
  const byId = new Map<string, AppCatalogExercise>();
  for (const ex of catalog) {
    byId.set(ex.id, ex);
    bySlug.set(slugMap.get(ex.id)!, ex);
  }

  if (args.includes("--stats")) {
    const done = implementedSlugs();
    const remaining = catalog.filter((ex) => !done.has(slugMap.get(ex.id)!));
    const byCat: Record<string, { done: number; total: number }> = {};
    for (const ex of catalog) {
      const c = (byCat[ex.category] ??= { done: 0, total: 0 });
      c.total++;
      if (done.has(slugMap.get(ex.id)!)) c.done++;
    }
    console.log(`Implemented: ${done.size} / ${catalog.length} (${remaining.length} remaining)`);
    for (const [cat, counts] of Object.entries(byCat)) {
      console.log(`  ${cat.padEnd(14)} ${counts.done} / ${counts.total}`);
    }
    return;
  }

  if (args.includes("--list-missing")) {
    const idx = args.indexOf("--list-missing");
    const limit = Number(args[idx + 1] ?? 30);
    const patternFilter = args.includes("--pattern") ? args[args.indexOf("--pattern") + 1] : null;
    const withImagesOnly = args.includes("--with-images");
    const done = implementedSlugs();
    const missing = catalog.filter((ex) => {
      if (done.has(slugMap.get(ex.id)!)) return false;
      if (patternFilter && !ex.movementPatterns.some((p) => p.toLowerCase().includes(patternFilter.toLowerCase())))
        return false;
      if (withImagesOnly && ex.images.length === 0) return false;
      return true;
    });
    missing.sort((a, b) => (b.searchBoost ?? 0) - (a.searchBoost ?? 0) || b.images.length - a.images.length);
    console.log(`Missing (${missing.length} total, showing ${Math.min(limit, missing.length)}):`);
    for (const ex of missing.slice(0, limit)) {
      const slug = slugMap.get(ex.id)!;
      console.log(
        `${slug.padEnd(48)} | ${ex.category.padEnd(11)} | img:${ex.images.length} md:${ex.hasInstructions ? 1 : 0} | ${ex.movementPatterns[0] ?? "none"} | ${ex.resistanceEquipment[0] ?? "Bodyweight"}`,
      );
    }
    return;
  }

  const outIdx = args.indexOf("--out-img-dir");
  const imgDir = outIdx >= 0 ? args[outIdx + 1] : "/tmp/motion-briefs";
  const queries = args.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));
  if (queries.length === 0) {
    throw new Error(
      "Usage: exercise-brief.ts <slug|catalogId|name>... [--out-img-dir /tmp/motion-briefs] | --stats | --list-missing [N]",
    );
  }

  const sections: string[] = [];
  for (const q of queries) {
    const ex =
      bySlug.get(q) ??
      byId.get(q) ??
      catalog.find((e) => e.name.toLowerCase() === q.toLowerCase());
    if (!ex) {
      throw new Error(`Could not find exercise "${q}" in exercises.json`);
    }
    sections.push(await formatBrief(ex, slugMap.get(ex.id)!, imgDir));
  }
  console.log(sections.join("\n---\n\n"));
}

await main();
