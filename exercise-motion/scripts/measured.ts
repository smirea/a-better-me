#!/usr/bin/env bun
import { analyze } from "../src/biomech";
import { generate, kinematics } from "../src/exercise";
import { EXERCISES } from "../src/exercises";
import { MEASURED, TIERS, type Tier } from "../src/measured";
import { MUSCLE_NAMES, MUSCLES, type Muscle } from "../src/muscles";

/** A quiet muscle should stay under this share of everything it has. */
const QUIET = 0.2;

export interface Comparison {
  id: string;
  loadKg: number;
  rows: {
    muscle: Muscle;
    tier: Tier | null;
    measured: [number, number] | null;
    /** Mean and peak activation over the lifting half, 0 to 1. */
    lifting: number;
    peak: number;
    /** Mean activation while lowering over mean while lifting. */
    lowering: number;
    measuredLowering: [number, number] | null;
  }[];
  /** Pairs of measured muscles in different tiers, and how many the model orders the same way. */
  pairs: number;
  agreeing: number;
  problems: string[];
}

export function compare(id: string): Comparison {
  const spec = EXERCISES.find((exercise) => exercise.id === id);
  const measured = MEASURED[id];
  if (!spec || !measured) throw new Error(`No measured activity for "${id}"`);
  const { body, sequence } = generate(spec);
  const analysis = analyze(body, sequence, kinematics(body, sequence));
  const mean = (m: number, lifting: boolean) => {
    let sum = 0;
    let count = 0;
    analysis.activation.forEach((row, f) => {
      if (analysis.power[f] > 0 !== lifting) return;
      sum += Math.max(row[m * 2], row[m * 2 + 1]);
      count++;
    });
    return count ? sum / count : 0;
  };
  const rows = MUSCLES.map((muscle, m) => {
    const entry = measured.muscles[muscle];
    const lifting = mean(m, true);
    return {
      muscle,
      tier: entry?.tier ?? null,
      measured: entry?.lifting ?? null,
      lifting,
      peak: analysis.peak[muscle].activation,
      lowering: lifting > 0.02 ? mean(m, false) / lifting : 0,
      measuredLowering: entry?.lowering ?? null,
    };
  })
    .filter((row) => row.tier || row.lifting >= 0.1)
    .sort((a, b) => b.lifting - a.lifting);

  const ranked = rows.filter((row) => row.tier);
  const hardest = Math.max(...rows.map((row) => row.lifting));
  const problems: string[] = [];
  let pairs = 0;
  let agreeing = 0;
  for (const a of ranked)
    for (const b of ranked) {
      const gap = TIERS.indexOf(b.tier!) - TIERS.indexOf(a.tier!);
      if (gap <= 0) continue;
      pairs++;
      if (a.lifting > b.lifting) agreeing++;
      else if (gap >= 2)
        problems.push(
          `${MUSCLE_NAMES[b.muscle]} (${b.tier}) out-works ${MUSCLE_NAMES[a.muscle]} (${a.tier}): ${percent(b.lifting)} against ${percent(a.lifting)}`,
        );
    }
  for (const row of ranked) {
    if (row.tier === "prime" && row.lifting < 0.5 * hardest)
      problems.push(`${MUSCLE_NAMES[row.muscle]} leads in every study but works at ${percent(row.lifting)}, under half the model's hardest muscle`);
    if (row.tier === "quiet" && row.lifting > QUIET)
      problems.push(`${MUSCLE_NAMES[row.muscle]} is measured quiet but works at ${percent(row.lifting)}`);
  }
  for (const row of rows)
    if (!row.tier && row.lifting > 0.5 * hardest)
      problems.push(`${MUSCLE_NAMES[row.muscle]} works at ${percent(row.lifting)} and no study measured it`);
  return { id, loadKg: sequence.loadKg, rows, pairs, agreeing, problems };
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const range = (pair: [number, number] | null, format: (value: number) => string) =>
  !pair ? "" : pair[0] === pair[1] ? format(pair[0]) : `${format(pair[0])} to ${format(pair[1])}`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const ids = args.filter((arg) => !arg.startsWith("--"));
  const results = (ids.length ? ids : Object.keys(MEASURED)).map(compare);
  if (json) console.log(JSON.stringify(results));
  else
    for (const result of results) {
      console.log(`\n## ${result.id}, ${result.loadKg} kg (measured at: ${MEASURED[result.id].load})\n`);
      console.log("| Muscle | Measured tier | Measured lifting, % of maximum | Model lifting, mean (peak) | Lowering over lifting: measured | model |");
      console.log("|---|---|---|---|---|---|");
      for (const row of result.rows)
        console.log(
          `| ${MUSCLE_NAMES[row.muscle]} | ${row.tier ?? "not measured"} | ${range(row.measured, String)} | ${percent(row.lifting)} (${percent(row.peak)}) | ${range(row.measuredLowering, (v) => v.toFixed(2))} | ${row.lowering.toFixed(2)} |`,
        );
      console.log(`\nOrder agrees for ${result.agreeing} of ${result.pairs} pairs of muscles in different tiers.`);
      for (const problem of result.problems) console.log(`- ${problem}`);
    }
}
