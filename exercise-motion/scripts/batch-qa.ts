#!/usr/bin/env bun
import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/biomech";
import { generate, kinematics } from "../src/exercise";
import { validateGlbMotion } from "../src/glb-collision";
import { contactSheet } from "../src/sheet";
import { runChecks, validateLoad, validateMotion } from "../src/validate";
import { loadSpec } from "./catalog-io";

/**
 * Validates a list of exercise slugs in one pass and composites a compact visual QA mosaic
 * (start + peak angle/side stills per exercise) so waves of 10-50 exercises can be audited quickly.
 */
async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outPng = outIdx >= 0 ? args[outIdx + 1] : "/tmp/motion-inspect/batch-qa.png";
  const slugs = args.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));
  if (slugs.length === 0) throw new Error("Usage: batch-qa.ts <slug>... [--out /tmp/motion-inspect/batch-qa.png]");

  const tmpDir = "/tmp/motion-inspect/qa-tiles";
  mkdirSync(tmpDir, { recursive: true });
  const tilePngs: string[] = [];
  let failed = 0;

  for (const slug of slugs) {
    try {
      const spec = await loadSpec(slug);
      const { body, built, sequence } = generate(spec);
      const kin = kinematics(body, sequence);
      const analysis = analyze(body, sequence, kin);
      const glbIssues = await validateGlbMotion(body, sequence, kin);
      const issues = [
        ...validateMotion(body, sequence, kin),
        ...glbIssues,
        ...validateLoad(sequence, analysis),
      ];
      const errors = issues.filter((i) => i.severity === "error");
      const checks = runChecks(body, built, sequence, kin);
      const failedChecks = checks.filter((c) => !c.pass);
      const ok = errors.length === 0 && failedChecks.length === 0 && checks.length >= 2;
      if (!ok) failed++;
      console.log(
        `${ok ? "PASS" : "FAIL"}  ${slug.padEnd(46)} err=${errors.length} warn=${issues.length - errors.length} glb=${glbIssues.length} checks=${checks.length - failedChecks.length}/${checks.length}`,
      );
      for (const e of errors) console.log(`        ERR [${e.code}] ${e.title}: ${e.detail}`);
      for (const w of issues.filter((i) => i.severity === "warning"))
        console.log(`        WRN [${w.code}] ${w.title}: ${w.detail}`);
      for (const c of failedChecks) console.log(`        CHK FAIL ${c.label}: ${c.measured}`);

      const mid = sequence.phases[1]?.from ?? Math.floor(sequence.poses.length / 2);
      const svg = contactSheet(sequence, [0, mid], ["side", "angle"], body);
      const svgPath = join(tmpDir, `${slug}.svg`);
      const pngPath = join(tmpDir, `${slug}.png`);
      await Bun.write(svgPath, svg);
      await $`rsvg-convert -w 540 ${svgPath} -o ${pngPath}`.quiet();
      tilePngs.push(pngPath);
    } catch (error) {
      failed++;
      console.log(`CRASH ${slug}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }
  }

  if (tilePngs.length > 0) {
    const cols = Math.min(3, tilePngs.length);
    const rows: string[] = [];
    for (let i = 0; i < tilePngs.length; i += cols) {
      const rowPng = join(tmpDir, `_row_${i}.png`);
      await $`magick ${tilePngs.slice(i, i + cols)} -background "#111" +append ${rowPng}`.quiet();
      rows.push(rowPng);
    }
    await $`magick ${rows} -background "#111" -append ${outPng}`.quiet();
    console.log(`\nQA mosaic: ${outPng} (${tilePngs.length} exercises, ${failed} failed)`);
  }
  if (failed > 0) process.exit(1);
}

await main();
