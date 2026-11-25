#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EquipmentMeta } from "../gym/catalog";
import { buildGymLayout, findLayoutOverlaps } from "../gym/layout";

const ROOT = join(import.meta.dir, "..");
const GYM_DIR = join(ROOT, "gym");
const OUT_DIR = join(ROOT, "dist", "gym");
const MANIFEST_PATH = join(OUT_DIR, "manifest.json");

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `Missing ${MANIFEST_PATH}. Run \`bun exercise-motion/scripts/gym-fetch.ts\` and \`bun exercise-motion/scripts/gym-debrand.ts\` first.`,
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = (await Bun.file(MANIFEST_PATH).json()) as EquipmentMeta[];
  const plan = buildGymLayout(manifest);
  const overlaps = findLayoutOverlaps(plan);
  if (overlaps.length > 0) {
    throw new Error(
      `Gym layout has ${overlaps.length} overlapping equipment pairs: ${overlaps
        .slice(0, 5)
        .map(([a, b]) => `${a} <> ${b}`)
        .join(", ")}`,
    );
  }

  writeFileSync(join(OUT_DIR, "plan.json"), JSON.stringify(plan, null, 2));

  const bundle = await Bun.build({
    entrypoints: [join(GYM_DIR, "viewer.ts")],
    minify: true,
    target: "browser",
  });
  if (!bundle.success) {
    throw new AggregateError(bundle.logs, "3D gym viewer bundle failed");
  }
  const script = (await bundle.outputs[0].text()).replaceAll("</script", "<\\/script");
  const css = await Bun.file(join(GYM_DIR, "style.css")).text();
  const template = await Bun.file(join(GYM_DIR, "index.html")).text();
  const planJson = JSON.stringify(plan).replaceAll("</", "<\\/");

  const html = template
    .replace("/*STYLE*/", () => css)
    .replace("__PLAN__", () => planJson)
    .replace("/*SCRIPT*/", () => script);

  const outHtml = join(OUT_DIR, "index.html");
  writeFileSync(outHtml, html);

  const totalBytes = manifest.reduce((s, m) => s + m.bytes, 0);
  const totalTris = manifest.reduce((s, m) => s + m.tris, 0);
  console.log(`Built 3D commercial gym: ${outHtml}`);
  console.log(
    `  Equipment: ${plan.items.length} unbranded models | ${(totalBytes / 1e6).toFixed(1)} MB models | ${totalTris.toLocaleString()} tris`,
  );
  console.log(
    `  Floorplan: ${plan.width} × ${plan.depth} m (${Math.round(plan.width * plan.depth)} m² / ${Math.round(plan.width * plan.depth * 10.764).toLocaleString()} sq ft) | 0 overlaps`,
  );
  for (const z of plan.zones) {
    console.log(
      `  - ${z.name.padEnd(28)} ${String(z.count).padStart(3)} pcs | ${(z.maxX - z.minX).toFixed(1)}×${(z.maxZ - z.minZ).toFixed(1)} m`,
    );
  }
}

await main();
