#!/usr/bin/env bun
/**
 * Maps every catalog exercise onto canonical machines and props and writes
 * `src/machines/catalog-clusters.json`. Fails when a raw equipment label matches no rule.
 *
 *   ./exercise-motion/scripts/machines/cluster-catalog.ts [--stats]
 */
import { join } from "node:path";
import {
  BUILT_MACHINES,
  BUILT_PROPS,
  ENGINE_BUILT,
  cableAttachmentFor,
  PIECE_RULES,
  RESISTANCE_RULES,
  SUPPORT_RULES,
  TIER3,
  type CanonicalId,
  type ExerciseContext,
  type Rule,
} from "../../src/machines/equipment-map";
import { MOTION_ROOT, REPO_ROOT } from "../catalog-io";

interface CatalogExercise extends ExerciseContext {
  id: string;
  category: string;
  resistanceEquipment: string[];
  supportEquipment: string[];
}

interface Resolved {
  ids: CanonicalId[];
  substitute: boolean;
}

const exercises = (await Bun.file(join(REPO_ROOT, "app-ios/Sources/CoreResources/Catalog/exercises.json")).json()) as CatalogExercise[];
const built = new Set<string>([...BUILT_MACHINES, ...BUILT_PROPS, ...ENGINE_BUILT]);
const tier3 = new Set<string>(TIER3);
const unmatched = new Set<string>();
const labelHits = new Map<string, { kind: string; ids: Set<string>; count: number }>();

const apply = (rule: Rule, ex: ExerciseContext): Resolved => ({
  ids: typeof rule.ids === "function" ? rule.ids(ex) : rule.ids,
  substitute: !!rule.substitute,
});

function record(kind: string, label: string, r: Resolved) {
  const hit = labelHits.get(`${kind}:${label}`) ?? { kind, ids: new Set<string>(), count: 0 };
  for (const id of r.ids) hit.ids.add(id);
  hit.count++;
  labelHits.set(`${kind}:${label}`, hit);
}

function resistance(label: string, ex: ExerciseContext): Resolved {
  const rule = RESISTANCE_RULES.find((r) => r.match.test(label));
  if (!rule) {
    unmatched.add(`resistance: ${label}`);
    return { ids: [], substitute: false };
  }
  const r = apply(rule, ex);
  record("resistance", label, r);
  return r;
}

function support(label: string, ex: ExerciseContext): Resolved {
  const whole = SUPPORT_RULES.find((r) => r.match.test(label));
  if (whole) {
    const r = apply(whole, ex);
    record("support", label, r);
    return r;
  }
  const pieces = label
    .split(/,\s*(?:and\s+)?|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const ids: CanonicalId[] = [];
  let substitute = false;
  for (const piece of pieces) {
    const rule = PIECE_RULES.find((r) => r.match.test(piece)) ?? SUPPORT_RULES.find((r) => r.match.test(piece));
    if (!rule) {
      unmatched.add(`support: ${label} (piece "${piece}")`);
      continue;
    }
    const r = apply(rule, ex);
    ids.push(...r.ids);
    substitute ||= r.substitute;
  }
  const r = { ids, substitute };
  record("support", label, r);
  return r;
}

const tierOf = (ids: CanonicalId[]) => (ids.some((i) => tier3.has(i)) ? 3 : ids.every((i) => built.has(i)) ? 1 : 2);
const CABLE = new Set<string>(["dual-adjustable-pulley", "single-cable-tower", "lat-pulldown", "seated-cable-row"]);

const rows = exercises.map((ex) => {
  const rOpts = ex.resistanceEquipment.length ? ex.resistanceEquipment.map((l) => ({ label: l, ...resistance(l, ex) })) : [{ label: "Bodyweight only", ids: [], substitute: false }];
  const sOpts = ex.supportEquipment.length ? ex.supportEquipment.map((l) => ({ label: l, ...support(l, ex) })) : [{ label: null, ids: [], substitute: false }];
  let best: { tier: number; ids: CanonicalId[]; substitute: boolean; resistance: string; support: string | null } | undefined;
  for (const r of rOpts) {
    for (const s of sOpts) {
      const ids = [...new Set([...r.ids, ...s.ids])] as CanonicalId[];
      if (ids.some((i) => CABLE.has(i))) ids.push(cableAttachmentFor(ex));
      const cand = { tier: tierOf(ids), ids: [...new Set(ids)], substitute: r.substitute || s.substitute, resistance: r.label, support: s.label };
      const better =
        !best ||
        cand.tier < best.tier ||
        (cand.tier === best.tier && Number(cand.substitute) < Number(best.substitute)) ||
        (cand.tier === best.tier && cand.substitute === best.substitute && cand.ids.length < best.ids.length);
      if (better) best = cand;
    }
  }
  const b = best!;
  return {
    id: ex.id,
    name: ex.name,
    category: ex.category,
    tier: b.tier,
    machines: b.ids.filter((i) => !i.startsWith("prop-") && !tier3.has(i)),
    props: b.ids.filter((i) => i.startsWith("prop-")),
    missing: b.ids.filter((i) => !built.has(i)),
    ...(b.substitute ? { substitute: true } : {}),
    resistance: b.resistance,
    support: b.support,
  };
});

if (unmatched.size) {
  console.error(`Unmatched equipment labels:\n- ${[...unmatched].sort().join("\n- ")}`);
  process.exit(1);
}

const out = join(MOTION_ROOT, "src", "machines", "catalog-clusters.json");
await Bun.write(out, `${JSON.stringify(rows, null, 1)}\n`);

const count = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).length;
const pct = (n: number) => `${((100 * n) / rows.length).toFixed(1)}%`;
const resLabels = [...labelHits.values()].filter((h) => h.kind === "resistance").length;
const supLabels = [...labelHits.values()].filter((h) => h.kind === "support").length;
const canonical = new Set([...labelHits.values()].flatMap((h) => [...h.ids]));
const t1 = count((r) => r.tier === 1);
const t2 = count((r) => r.tier === 2);
const t3 = count((r) => r.tier === 3);
console.log(`exercises: ${rows.length}`);
console.log(`raw labels: ${resLabels} resistance + ${supLabels} support = ${resLabels + supLabels}`);
console.log(`canonical ids referenced: ${canonical.size} (${[...canonical].filter((i) => built.has(i)).length} built)`);
console.log(`tier 1 (fully built): ${t1} (${pct(t1)}), of which substitutes: ${count((r) => r.tier === 1 && !!r.substitute)}`);
console.log(`tier 2 (needs an unbuilt canonical): ${t2} (${pct(t2)})`);
console.log(`tier 3 (out of scope): ${t3} (${pct(t3)})`);

if (process.argv.includes("--stats")) {
  const use = new Map<string, number>();
  for (const r of rows) for (const id of [...r.machines, ...r.props]) use.set(id, (use.get(id) ?? 0) + 1);
  console.log("\nexercises per canonical id (chosen option):");
  for (const [id, n] of [...use].sort((a, b) => b[1] - a[1])) console.log(`  ${built.has(id) ? "✓" : " "} ${id.padEnd(24)} ${n}`);
  const missing = new Map<string, number>();
  for (const r of rows) for (const id of r.missing) missing.set(id, (missing.get(id) ?? 0) + 1);
  console.log("\nunbuilt canonical ids blocking exercises:");
  for (const [id, n] of [...missing].sort((a, b) => b[1] - a[1])) console.log(`  ${id.padEnd(24)} ${n}`);
  const byCat = new Map<string, [number, number]>();
  for (const r of rows) {
    const c = byCat.get(r.category) ?? [0, 0];
    c[1]++;
    if (r.tier === 1) c[0]++;
    byCat.set(r.category, c);
  }
  console.log("\ntier 1 by category:");
  for (const [c, [a, n]] of byCat) console.log(`  ${c.padEnd(12)} ${a}/${n} (${((100 * a) / n).toFixed(1)}%)`);
}
