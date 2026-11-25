#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { analyze } from "../src/biomech";
import { anchorPoint } from "../src/body";
import { groupsOf } from "../src/catalog";
import { generate, kinematics, type ExerciseSpec } from "../src/exercise";
import { deg } from "../src/math";
import { MUSCLES } from "../src/muscles";
import { contactSheet } from "../src/sheet";
import { runChecks, validateLoad, validateMotion } from "../src/validate";
import {
  catalogSlugMap,
  exerciseImageFiles,
  loadAppCatalog,
  MOTION_ROOT,
} from "./catalog-io";

async function loadSpec(target: string): Promise<{ spec: ExerciseSpec; filePath: string }> {
  const candidates = [
    target,
    join(MOTION_ROOT, "src", "exercises", `${target}.ts`),
    join(MOTION_ROOT, "src", "exercises", target),
  ];
  const filePath = candidates.find((p) => existsSync(p) && p.endsWith(".ts"));
  if (!filePath) {
    throw new Error(`Could not locate exercise spec file for "${target}". Tried:\n  ${candidates.join("\n  ")}`);
  }
  const mod = (await import(resolve(filePath))) as Record<string, unknown>;
  const spec = (mod.spec ??
    Object.values(mod).find(
      (v): v is ExerciseSpec =>
        typeof v === "object" &&
        v !== null &&
        "id" in v &&
        "catalogId" in v &&
        "build" in v &&
        typeof (v as ExerciseSpec).build === "function",
    )) as ExerciseSpec | undefined;
  if (!spec) {
    throw new Error(`${filePath}: does not export an ExerciseSpec (expected \`export const spec: ExerciseSpec = ...\`).`);
  }
  return { spec, filePath };
}

async function compositeWithReference(sheetPng: string, refWebps: string[], outPng: string) {
  if (refWebps.length === 0) return null;
  const refStrip = outPng.replace(/\.png$/, "-refs.png");
  const resizedArgs: string[] = [];
  for (const w of refWebps) {
    resizedArgs.push("(", w, "-resize", "x320", ")");
  }
  await $`magick ${resizedArgs} -background "#151414" +append ${refStrip}`.quiet();
  await $`magick ${sheetPng} ${refStrip} -background "#151414" -gravity center -append ${outPng}`.quiet();
  return outPng;
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : "/tmp/motion-inspect";
  const targets = args.filter((a, i) => !a.startsWith("--") && !(outIdx >= 0 && i === outIdx + 1));
  if (targets.length === 0) {
    throw new Error("Usage: inspect-exercise.ts <slug-or-path>... [--out /tmp/motion-inspect]");
  }

  mkdirSync(outDir, { recursive: true });
  const catalog = loadAppCatalog();
  const slugMap = catalogSlugMap();
  let anyFailure = false;

  for (const target of targets) {
    const { spec, filePath } = await loadSpec(target);
    const expectedFileSlug = basename(filePath, ".ts");
    if (spec.id !== expectedFileSlug) {
      throw new Error(
        `${filePath}: spec.id "${spec.id}" does not match filename "${expectedFileSlug}.ts".`,
      );
    }
    const entry = catalog.find((e) => e.id === spec.catalogId);
    if (!entry) {
      throw new Error(`${spec.id}: catalogId "${spec.catalogId}" not found in exercises.json.`);
    }
    const canonicalSlug = slugMap.get(entry.id);
    if (canonicalSlug && spec.id !== canonicalSlug) {
      console.warn(`NOTE: spec.id "${spec.id}" differs from canonical slug "${canonicalSlug}".`);
    }

    const t0 = performance.now();
    const { body, built, sequence } = generate(spec);
    const ms = performance.now() - t0;
    const kin = kinematics(body, sequence);
    const analysis = analyze(body, sequence, kin);
    const motionIssues = validateMotion(body, sequence, kin);
    const loadIssues = validateLoad(sequence, analysis);
    const allIssues = [...motionIssues, ...loadIssues];
    const checks = runChecks(body, built, sequence, kin);

    if (checks.length < 2) {
      console.error(`ERROR: ${spec.id} defines only ${checks.length} form checks (minimum 2 required).`);
      anyFailure = true;
    }

    const ranked = [...MUSCLES].toSorted(
      (a, b) => analysis.peak[b].activation - analysis.peak[a].activation,
    );
    const stretched = groupsOf(entry.selection?.stretchedMuscles ?? []);

    const errors = allIssues.filter((i) => i.severity === "error");
    const warnings = allIssues.filter((i) => i.severity === "warning");
    const failedChecks = checks.filter((c) => !c.pass);
    const passed = errors.length === 0 && failedChecks.length === 0 && checks.length >= 2;
    if (!passed) anyFailure = true;

    console.log(`\n======================================================================`);
    console.log(
      `${passed ? "PASS" : "FAIL"}  ${spec.name} (${spec.id}) — ${sequence.poses.length} frames, ${sequence.loadKg} kg (${sequence.loadUnit}), ${ms.toFixed(0)} ms`,
    );
    console.log(`  Support: ${sequence.support.kind}${sequence.support.rail ? " (rail)" : ""} | Laterality: ${sequence.laterality ?? "bilateral"} | Props: ${sequence.props.map((p) => p.id).join(", ") || "none"} | Tethers: ${sequence.tethers?.length ?? 0}`);
    console.log(`  Issues: ${errors.length} error(s), ${warnings.length} warning(s) | Checks: ${checks.length - failedChecks.length}/${checks.length} pass`);

    for (const issue of allIssues) {
      console.log(
        `  ${issue.severity.toUpperCase().padEnd(7)} [${issue.code}] ${issue.title}: ${issue.detail} (frames ${issue.frames.map((r) => r.join("-")).join(", ")})`,
      );
    }
    for (const check of checks) {
      console.log(`  ${check.pass ? "pass" : "FAIL"}    ${check.label}: ${check.measured}`);
    }

    const pct = (v: number) => `${Math.round(v * 100)}%`;
    console.log(
      `  Top muscles: ${ranked
        .slice(0, 6)
        .map((m) => `${m} ${pct(analysis.peak[m].activation)}`)
        .join(", ")}`,
    );
    console.log(
      `  Catalog: primary=[${entry.primaryMuscles.join(", ")}] secondary=[${entry.secondaryMuscles.join(", ")}] stretched=[${stretched.join(", ")}]`,
    );

    // Key anchor & joint angle diagnostics at start and peak frames so pose adjustments need no extra probe scripts.
    const topIdx = 0;
    const midIdx = sequence.phases[1]?.from ?? Math.floor(sequence.poses.length / 2);
    const fmt = (idx: number, name: string) => {
      const p = anchorPoint(body, kin.frames[idx], name);
      return `${name}=(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`;
    };
    const fmtAng = (idx: number) => {
      const a = kin.angles[idx];
      const keys = ["shoulder_L.elev", "elbow_L.flex", "clavicle_L.elev", "hip_L.flex", "knee_L.flex", "lumbar.flex"];
      return keys.map((k) => `${k.replace("_L", "")}=${deg(a[k] ?? 0).toFixed(0)}°`).join(" ");
    };
    console.log(
      `  Anchors start: ${["pelvisBottom", "sternum", "grip_L", "heel_L"].map((a) => fmt(topIdx, a)).join("  ")}`,
    );
    console.log(
      `  Anchors peak:  ${["pelvisBottom", "sternum", "grip_L", "heel_L"].map((a) => fmt(midIdx, a)).join("  ")}`,
    );
    console.log(`  Angles  start: ${fmtAng(topIdx)}`);
    console.log(`  Angles  peak:  ${fmtAng(midIdx)}`);
    const unmetSummary = [...new Set(analysis.unmet.flat().map((u) => `${u.dof}(${Math.round(u.fraction * 100)}%)`))];
    if (unmetSummary.length) console.log(`  Unmet torques: ${unmetSummary.slice(0, 6).join(", ")}`);

    // Render orthographic contact sheet (side, front, angle across 5 phases; full cycle for multi-waypoint lifts)
    const lower = sequence.phases[0];
    const isMulti = sequence.phases.length > 4;
    const sampleFrames = (isMulti ? [0, 0.22, 0.48, 0.72, 0.94] : [0, 0.25, 0.5, 0.75, 1]).map((u) =>
      isMulti
        ? Math.min(sequence.poses.length - 1, Math.round((sequence.poses.length - 1) * u))
        : Math.min(sequence.poses.length - 1, Math.round(lower.from + (lower.to + 1 - lower.from) * u)),
    );
    const svg = contactSheet(sequence, sampleFrames, ["side", "front", "angle"], body);
    const svgPath = join(outDir, `${spec.id}-sheet.svg`);
    const pngPath = join(outDir, `${spec.id}-sheet.png`);
    await Bun.write(svgPath, svg);
    await $`rsvg-convert ${svgPath} -o ${pngPath}`.quiet();

    const refWebps = exerciseImageFiles(entry);
    const comparePath = join(outDir, `${spec.id}-compare.png`);
    const combined = await compositeWithReference(pngPath, refWebps, comparePath);
    console.log(`  Contact sheet: ${combined ?? pngPath}`);
  }

  if (anyFailure) process.exit(1);
}

await main();
