#!/usr/bin/env bun
import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/biomech";
import { anchorPoint, type Body } from "../src/body";
import { compileParts, propParts, signedDistance } from "../src/equipment";
import { generate, kinematics, type Kinematics, type Sequence } from "../src/exercise";
import { CYLINDER_GRIPS, graspHandleAt, gripCenter } from "../src/grasp";
import { deg } from "../src/math";
import { jointRanges } from "../src/solver";
import { validateGlbMotion } from "../src/glb-collision";
import { contactSheet } from "../src/sheet";
import { runChecks, validateLoad, validateMotion } from "../src/validate";
import { loadSpec } from "./catalog-io";

const MAJOR = ["hip_L.flex", "hip_R.flex", "knee_L.flex", "knee_R.flex", "ankle_L.dorsi", "ankle_R.dorsi", "lumbar.flex", "thoracic.flex", "neck.flex", "shoulder_L.elev", "shoulder_R.elev", "elbow_L.flex", "elbow_R.flex", "wrist_L.flex", "wrist_L.dev"];

/**
 * What an author needs to see which constraint is fighting: the key angles, every joint near its limit, each required
 * contact's gap and each grasp's offset at the start and peak poses.
 */
function explain(body: Body, sequence: Sequence, kin: Kinematics) {
  const peak = sequence.phases[1]?.from ?? Math.floor(sequence.poses.length / 2);
  const fixed = compileParts(sequence.equipment);
  for (const [label, f] of [["start", 0], ["peak", peak]] as const) {
    const a = kin.angles[f];
    console.log(`        -- ${label} (frame ${f})`);
    console.log(`           angles: ${MAJOR.filter((k) => a[k] !== undefined).map((k) => `${k} ${deg(a[k]).toFixed(0)}`).join(", ")}`);
    const near: string[] = [];
    jointRanges(body, sequence.poses[f], a, (key, value, lo, hi) => {
      const margin = deg(Math.min(value - lo, hi - value));
      if (margin < 3) near.push(`${key} ${deg(value).toFixed(0)}° (${margin.toFixed(1)}° from ${value - lo < hi - value ? "min" : "max"})`);
    });
    console.log(`           near limits: ${near.length ? near.join(", ") : "none"}`);
    const shapes = [
      ...fixed,
      ...sequence.props.flatMap((prop, p) => compileParts(propParts(prop, sequence.loadKg), sequence.propStates[f][p])),
    ];
    const gaps = sequence.required.map((c) => {
      const point = anchorPoint(body, kin.frames[f], c.anchor);
      let gap: number;
      if (c.surfaceY !== undefined) gap = point.y - c.surfaceY;
      else if (c.part) gap = signedDistance(shapes.find((s) => s.part.id === c.part)!, point);
      else gap = Math.min(...shapes.filter((s) => s.part.id.startsWith(`${c.prop}.`)).map((s) => signedDistance(s, point)));
      return `${c.label} ${(gap * 100).toFixed(1)}`;
    });
    console.log(`           contact gaps cm (+ off, - in): ${gaps.join(", ") || "none"}`);
    const grips = (sequence.grasps ?? []).map((g) => {
      const h = graspHandleAt(g, sequence.props, sequence.propStates[f]);
      const d = gripCenter(body, kin.frames[f], g.side, g.grip, g.handle.radius).sub(h.pos);
      const along = d.dot(h.axis);
      const off = CYLINDER_GRIPS.has(g.grip) ? d.addScaledVector(h.axis, -along).length() : d.length();
      return `${g.side} off-axis ${(off * 1000).toFixed(0)} mm, along ${(along * 100).toFixed(1)} cm`;
    });
    if (grips.length) console.log(`           grasps: ${grips.join("; ")}`);
  }
}

/**
 * Validates a list of exercise slugs in one pass and composites a compact visual QA mosaic
 * (start + peak angle/side stills per exercise) so waves of 10-50 exercises can be audited quickly.
 */
async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outPng = outIdx >= 0 ? args[outIdx + 1] : "/tmp/motion-inspect/batch-qa.png";
  const slugs = args.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));
  const explainAll = args.includes("--explain");
  if (slugs.length === 0) throw new Error("Usage: batch-qa.ts <slug>... [--out /tmp/motion-inspect/batch-qa.png] [--explain]");

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
      if (explainAll) {
        for (const c of checks.filter((c) => c.pass)) console.log(`        CHK ok   ${c.label}: ${c.measured}`);
        explain(body, sequence, kin);
      }

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
