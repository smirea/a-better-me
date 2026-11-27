#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { analyze } from "../src/biomech";
import { groupsOf } from "../src/catalog";
import { generate, kinematics, type ExerciseSpec } from "../src/exercise";
import { EXERCISES } from "../src/exercises";
import { FAULTS } from "../src/faults";
import { resolveGlbPath, validateGlbMotion } from "../src/glb-collision";
import { MUSCLES, type Muscle } from "../src/muscles";
import { runChecks, validateLoad, validateMotion } from "../src/validate";
import { listedMuscles, loadAppCatalog, MOTION_ROOT, REPO_ROOT } from "./catalog-io";
import { cachePathFor, writeCache } from "./motion-cache";

const dist = join(MOTION_ROOT, "dist");
const libraryDir = join(dist, "library");
const seqDir = join(libraryDir, "sequences");
mkdirSync(seqDir, { recursive: true });

const args = process.argv.slice(2);
const noCache = args.includes("--no-cache");
const cacheOnly = args.includes("--cache-only");
const libraryOnly = args.includes("--library-only");
const singleIdx = args.indexOf("--single");
const singleId = singleIdx >= 0 ? args[singleIdx + 1] : null;
const onlyIds = cacheOnly
  ? new Set(args.filter((a) => !a.startsWith("--")))
  : singleId
    ? new Set([singleId])
    : null;

const catalog = loadAppCatalog();
const byCatalogId = new Map(catalog.map((e) => [e.id, e]));

const specsToBuild: ExerciseSpec[] = onlyIds
  ? EXERCISES.filter((s) => onlyIds.has(s.id))
  : EXERCISES;
if (singleId && specsToBuild.length === 0) {
  throw new Error(`Exercise "${singleId}" not found in EXERCISES.`);
}

// An effort-posed exercise takes tens of seconds on one core, so every uncached exercise past the first gets its own
// process, as many at once as there are cores to spare, and the build below reads them all from the cache.
const queue = specsToBuild
  .filter((spec) => {
    const cp = cachePathFor(spec);
    return noCache || !cp || !existsSync(cp);
  })
  .map((spec) => spec.id);
const workers = Math.min(queue.length, Math.max(1, availableParallelism() - 1));
const prebuilt = queue.length > 1 && workers > 1;
if (prebuilt) {
  const work = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const proc = Bun.spawn(
        ["bun", import.meta.path, "--cache-only", ...(noCache ? ["--no-cache"] : []), id],
        { stdout: "inherit", stderr: "inherit" },
      );
      const code = await proc.exited;
      if (code !== 0) throw new Error(`Building ${id} failed with exit code ${code}`);
    }
  };
  await Promise.all(Array.from({ length: workers }, work));
}
if (cacheOnly && prebuilt) process.exit(0);

interface BuiltItem {
  spec: ExerciseSpec;
  data: {
    sequence: ReturnType<typeof generate>["sequence"];
    checks: ReturnType<typeof runChecks>;
    catalog: { primary: Muscle[]; secondary: Muscle[]; stretched: Muscle[] };
    agreement: {
      listedInTop: number;
      listed: number;
      primaryMean: number;
      secondaryMean: number;
      otherMean: number;
      unexpected: Muscle[];
      stretchedFound: number;
      stretched: number;
    };
    faults: {
      id: string;
      label: string;
      what: string;
      expect: string[];
      caught: string[];
      raised: string[];
      sequence: ReturnType<typeof generate>["sequence"];
      checks: ReturnType<typeof runChecks>;
    }[];
    images: string[];
  };
  summary: {
    id: string;
    catalogId: string;
    name: string;
    alternativeNames: string[];
    category: string;
    movementPattern: string;
    primaryMuscles: Muscle[];
    secondaryMuscles: Muscle[];
    equipmentLabel: string;
    issueCount: number;
    checksPass: number;
    checksTotal: number;
  };
}

/** What one exercise's build leaves in the cache: everything the library and the report need from it. */
interface Built {
  data: BuiltItem["data"];
  summary: BuiltItem["summary"];
  motionIssues: number;
  loadIssues: number;
  report: string[];
  flagged: boolean;
}
/** A long build reports only the exercises with something wrong. */
const reported = (built: Built) => specsToBuild.length <= 25 || built.flagged;

const builtItems: BuiltItem[] = [];
/** A hash of everything the viewer shows for an exercise, so it reloads on any edit, not only when QA totals move. */
const withRevision = (b: BuiltItem) => ({
  ...b.summary,
  revision: createHash("sha256").update(JSON.stringify(b.data)).digest("hex").slice(0, 12),
});
const report: string[] = [
  "# Exercise motion evaluation",
  "",
  `Built ${specsToBuild.length} of ${catalog.length} app exercises.`,
  "",
];

let totalMotionIssues = 0;
let totalLoadIssues = 0;
let totalChecks = 0;
let passedChecks = 0;
let cacheHits = 0;

for (const spec of specsToBuild) {
  const entry = byCatalogId.get(spec.catalogId);
  if (!entry)
    throw new Error(`${spec.name}: catalog id ${spec.catalogId} is not in exercises.json`);

  const cachePath = cachePathFor(spec);

  if ((!noCache || prebuilt) && cachePath && existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as Built;
    cacheHits++;
    if (reported(cached)) report.push(...cached.report);
    totalMotionIssues += cached.motionIssues;
    totalLoadIssues += cached.loadIssues;
    totalChecks += cached.summary.checksTotal;
    passedChecks += cached.summary.checksPass;
    writeFileSync(join(seqDir, `${spec.id}.json`), JSON.stringify(cached.data));
    writeFileSync(join(dist, `${spec.id}.json`), JSON.stringify(cached.data.sequence));
    builtItems.push({ spec, data: cached.data, summary: cached.summary });
    continue;
  }

  const started = performance.now();
  const { body, built, sequence } = generate(spec);
  const seconds = (performance.now() - started) / 1000;
  const kin = kinematics(body, sequence);
  const analysis = analyze(body, sequence, kin);
  const issues = [
    ...validateMotion(body, sequence, kin),
    ...(await validateGlbMotion(body, sequence, kin)),
  ];
  const loadIssues = validateLoad(sequence, analysis, listedMuscles(spec));
  const checks = runChecks(body, built, sequence, kin);
  const stretched = groupsOf(entry.selection?.stretchedMuscles ?? []);

  totalMotionIssues += issues.length;
  totalLoadIssues += loadIssues.length;
  totalChecks += checks.length;
  passedChecks += checks.filter((c) => c.pass).length;

  const ranked = [...MUSCLES].toSorted(
    (a, b) => analysis.peak[b].activation - analysis.peak[a].activation,
  );
  const listed = [...entry.primaryMuscles, ...entry.secondaryMuscles];
  const top = ranked.slice(0, listed.length);
  const mean = (muscles: Muscle[]) =>
    muscles.length
      ? muscles.reduce((sum, muscle) => sum + analysis.peak[muscle].activation, 0) / muscles.length
      : 0;
  const others = MUSCLES.filter((muscle) => !listed.includes(muscle));
  const agreement = {
    listedInTop: listed.filter((muscle) => top.includes(muscle)).length,
    listed: listed.length,
    primaryMean: mean(entry.primaryMuscles),
    secondaryMean: mean(entry.secondaryMuscles),
    otherMean: mean(others),
    unexpected: top.filter((muscle) => !listed.includes(muscle)),
    stretchedFound: stretched.filter((muscle) => analysis.peak[muscle].stretch >= 0.4).length,
    stretched: stretched.length,
  };

  const faults = FAULTS.filter((fault) => fault.exercise === spec.id).map((fault) => {
    const broken = structuredClone(sequence);
    fault.apply?.(broken, body, built);
    if (fault.loadKg) broken.loadKg = fault.loadKg;
    const brokenKin = kinematics(body, broken);
    const brokenIssues = [
      ...validateMotion(body, broken, brokenKin),
      ...validateLoad(broken, analyze(body, broken, brokenKin)),
    ];
    const brokenChecks = runChecks(body, built, broken, brokenKin);
    const raised = [
      ...new Set([
        ...brokenIssues.map((issue) => issue.code),
        ...brokenChecks.filter((check) => !check.pass).map((check) => check.id),
      ]),
    ];
    const caught = fault.expect.filter((code) => raised.includes(code));
    return {
      id: fault.id,
      label: fault.label,
      what: fault.what,
      expect: fault.expect,
      caught,
      raised,
      sequence: broken,
      checks: brokenChecks,
    };
  });

  const libraryImages = entry.images
    .filter((name) => existsSync(join(REPO_ROOT, `app-ios/Assets/ExerciseImages/${name}.webp`)))
    .map((name) => `/exercise-images/${name}.webp`);

  const itemData = {
    sequence,
    checks,
    catalog: { primary: entry.primaryMuscles, secondary: entry.secondaryMuscles, stretched },
    agreement,
    faults,
    images: libraryImages,
  };

  writeFileSync(join(seqDir, `${sequence.id}.json`), JSON.stringify(itemData));
  writeFileSync(join(dist, `${sequence.id}.json`), JSON.stringify(sequence));

  const summary = {
    id: sequence.id,
    catalogId: sequence.catalogId,
    name: sequence.name,
    alternativeNames: entry.alternativeNames,
    category: entry.category,
    movementPattern: entry.movementPatterns[0] ?? "Other",
    primaryMuscles: entry.primaryMuscles,
    secondaryMuscles: entry.secondaryMuscles,
    equipmentLabel: entry.resistanceEquipment[0] ?? "Bodyweight",
    issueCount: issues.length + loadIssues.length,
    checksPass: checks.filter((c) => c.pass).length,
    checksTotal: checks.length,
  };

  const section: string[] = [];
  const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
  section.push(`## ${spec.name}`, "");
  section.push(`- Generated ${sequence.poses.length} frames in ${seconds.toFixed(2)} s.`);
  section.push(
    `- Motion issues flagged: ${issues.length}. Load issues at ${sequence.loadKg} kg: ${loadIssues.length}.`,
  );
  for (const issue of [...issues, ...loadIssues]) {
    section.push(`  - ${issue.severity.toUpperCase()} [${issue.code}] ${issue.title}: ${issue.detail}`);
  }
  section.push(
    `- Instruction checks: ${checks.filter((check) => check.pass).length} of ${checks.length} pass.`,
  );
  for (const check of checks.filter((item) => !item.pass))
    section.push(`  - FAIL ${check.label}: ${check.measured}`);
  section.push(
    `- Muscles the app lists (${listed.join(", ")}): ${agreement.listedInTop} of ${agreement.listed} in top ${listed.length} (primary ${pct(agreement.primaryMean)}, secondary ${pct(agreement.secondaryMean)}, unlisted ${pct(agreement.otherMean)}).`,
  );
  if (faults.length) {
    section.push(
      `- Injected faults caught: ${faults.filter((fault) => fault.caught.length).length} of ${faults.length}.`,
    );
  }
  section.push("");
  const result: Built = {
    data: itemData,
    summary,
    motionIssues: issues.length,
    loadIssues: loadIssues.length,
    report: section,
    flagged: issues.length > 0 || loadIssues.length > 0 || checks.some((c) => !c.pass),
  };
  if (cachePath) writeCache(cachePath, result);
  builtItems.push({ spec, data: itemData, summary });
  if (reported(result)) report.push(...section);
}

if (cacheOnly) {
  process.exit(0);
}

const bundle = await Bun.build({
  entrypoints: [join(MOTION_ROOT, "viewer/main.ts")],
  minify: true,
  target: "browser",
});
if (!bundle.success) throw new AggregateError(bundle.logs, "Viewer bundle failed");
const script = (await bundle.outputs[0].text()).replaceAll("</script", "<\\/script");
const css = (name: string) => Bun.file(join(MOTION_ROOT, `viewer/${name}.css`)).text();
const template = await Bun.file(join(MOTION_ROOT, "viewer/index.html")).text();
const fill = (page: string, slot: string, value: string) => {
  if (!page.includes(slot)) throw new Error(`viewer/index.html has no ${slot} slot`);
  return page.replace(slot, () => value);
};

// 1. Write scalable library app under dist/library/ (loads catalog.json + lazy-loads sequences/<id>.json)
writeFileSync(
  join(libraryDir, "catalog.json"),
  JSON.stringify(builtItems.map(withRevision)),
);
writeFileSync(join(libraryDir, "lifter.bin"), readFileSync(join(MOTION_ROOT, "viewer/assets/lifter.bin")));
writeFileSync(join(libraryDir, "muscle-map.png"), readFileSync(join(MOTION_ROOT, "viewer/assets/muscle-map.png")));

const libHtml = fill(
  fill(
    fill(
      fill(
        fill(template, "/*STYLE*/", (await css("style")) + (await css("page"))),
        "__DATA__",
        JSON.stringify({ mode: "library" }),
      ),
      "__LIFTER__",
      "",
    ),
    "__MUSCLE_MAP__",
    "",
  ),
  "/*SCRIPT*/",
  script,
);
writeFileSync(join(libraryDir, "index.html"), libHtml);
// The open viewer polls this and reloads itself when the app (not just the exercise list) was rebuilt.
writeFileSync(
  join(libraryDir, "version.json"),
  JSON.stringify({ app: createHash("sha256").update(libHtml).digest("hex").slice(0, 12) }),
);

if (libraryOnly) {
  console.log(
    `Built ${builtItems.length} exercises (${cacheHits} cached) | motion issues: ${totalMotionIssues} | load issues: ${totalLoadIssues} | checks: ${passedChecks}/${totalChecks}`,
  );
  console.log(`Library:     ${join(libraryDir, "index.html")} (${builtItems.length} lazy-loaded exercises)`);
  process.exit(0);
}

// 2. Also write self-contained single-file viewer (dist/exercise-motion.html & dist/exercise-motion-embed.html)
// containing ALL built exercises gzip-compressed for instant offline / inline T3 playback.
const round3 = (v: unknown): unknown => {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
  if (Array.isArray(v)) return v.map(round3);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = round3(val);
    return out;
  }
  return v;
};
const compressedAll = gzipSync(
  Buffer.from(JSON.stringify(round3(builtItems.map((item) => ({ ...item.data, images: [] }))))),
  { level: 9 },
).toString("base64");
// The single-file viewers carry every GLB their exercises reference, so they show the equipment with no server.
const modelIds = new Set<string>();
for (const item of builtItems) {
  for (const ref of item.data.sequence.glb ?? []) modelIds.add(ref.id);
  for (const prop of item.data.sequence.props) if (prop.kind === "glb") modelIds.add(prop.glbId);
}
const models: Record<string, string> = {};
for (const id of modelIds) {
  const path = resolveGlbPath(id);
  if (!path) throw new Error(`Missing GLB ${id} for the single-file viewer`);
  models[id] = Buffer.from(await Bun.file(path).arrayBuffer()).toString("base64");
}
const json = JSON.stringify({
  mode: "embedded-library",
  catalog: builtItems.map(withRevision),
  exercisesGz: compressedAll,
  models,
}).replaceAll("</", "<\\/");
const asset = async (name: string) =>
  Buffer.from(await Bun.file(join(MOTION_ROOT, "viewer/assets", name)).arrayBuffer()).toString("base64");
const lifter = await asset("lifter.bin");
const muscleMap = await asset("muscle-map.png");
const slots: [string, string][] = [
  ["__DATA__", json],
  ["__LIFTER__", lifter],
  ["__MUSCLE_MAP__", muscleMap],
  ["/*SCRIPT*/", script],
];
const page = async (layout: string) =>
  slots.reduce(
    (html, [slot, value]) => fill(html, slot, value),
    fill(template, "/*STYLE*/", (await css("style")) + (await css(layout))),
  );
const html = await page("page");
await Bun.write(join(dist, "exercise-motion-embed.html"), await page("embed"));
await Bun.write(join(dist, "exercise-motion.html"), html);
await Bun.write(join(dist, "evaluation.md"), report.join("\n"));

const missed = builtItems.flatMap((item) =>
  item.data.faults
    .filter((fault) => !fault.caught.length)
    .map((fault) => `${item.spec.name}: ${fault.label}`),
);
if (missed.length)
  throw new Error(`Fault tests went uncaught, so a detector is broken: ${missed.join("; ")}`);

console.log(
  `Built ${builtItems.length} exercises (${cacheHits} cached) | motion issues: ${totalMotionIssues} | load issues: ${totalLoadIssues} | checks: ${passedChecks}/${totalChecks}`,
);
console.log(`Library:     ${join(libraryDir, "index.html")} (${builtItems.length} lazy-loaded exercises)`);
console.log(`Single-file: ${join(dist, "exercise-motion.html")} (${(html.length / 1e6).toFixed(2)} MB)`);
