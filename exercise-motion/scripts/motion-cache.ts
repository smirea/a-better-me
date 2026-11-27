import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createBody } from "../src/body";
import { generate, type ExerciseSpec, type Generated } from "../src/exercise";
import { EXERCISES } from "../src/exercises";
import { loadAppCatalog, MOTION_ROOT } from "./catalog-io";

export const CACHE_DIR = join(MOTION_ROOT, ".cache", "motion-build");

const engineHash = createHash("sha256");
for (const dir of ["src", "src/machines"])
  for (const f of readdirSync(join(MOTION_ROOT, dir)).sort())
    if ((f.endsWith(".ts") && !f.endsWith(".test.ts")) || f.endsWith(".json"))
      engineHash.update(readFileSync(join(MOTION_ROOT, dir, f)));
// The build script decides what is cached with each sequence too: its issues, its report and its muscles.
for (const f of ["build.ts", "catalog-io.ts", "motion-cache.ts"]) engineHash.update(readFileSync(join(import.meta.dir, f)));
/** One fingerprint over the engine's sources, so any engine edit invalidates every cached exercise. */
const ENGINE_SIG = engineHash.digest("hex").slice(0, 12);

/** Where an exercise's build is cached, or null for a spec that lives outside `src/exercises/`. */
export function cachePathFor(spec: ExerciseSpec): string | null {
  const srcPath = join(MOTION_ROOT, "src", "exercises", `${spec.id}.ts`);
  if (!existsSync(srcPath)) return null;
  const entry = loadAppCatalog().find((exercise) => exercise.id === spec.catalogId) ?? null;
  const specSig = createHash("sha256")
    .update(ENGINE_SIG)
    .update(readFileSync(srcPath))
    .update(JSON.stringify(entry))
    .digest("hex")
    .slice(0, 16);
  return join(CACHE_DIR, `${spec.id}.${specSig}.json`);
}

/** Written whole or not at all, since a watcher's build and a script's can finish the same exercise at once. */
export function writeCache(path: string, value: unknown) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const partial = `${path}.${process.pid}.partial`;
  writeFileSync(partial, JSON.stringify(value));
  renameSync(partial, path);
}

const cacheable = (spec: ExerciseSpec) => EXERCISES.some((exercise) => exercise.id === spec.id) && cachePathFor(spec);

/** Builds the specs not cached yet, in parallel, by the build script, so they land in the cache for the next build too. */
export async function warm(specs: ExerciseSpec[]) {
  const missing = specs.filter((spec) => {
    const path = cacheable(spec);
    return path && !existsSync(path);
  });
  if (missing.length) {
    const proc = Bun.spawn(["bun", join(import.meta.dir, "build.ts"), "--cache-only", ...missing.map((spec) => spec.id)], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = await proc.exited;
    if (code !== 0) throw new Error(`Building ${missing.map((spec) => spec.id).join(", ")} failed with exit code ${code}`);
  }
}

/**
 * The generated rep of each spec, read from the build cache after warming it. Only posing a rep is slow: the body
 * and the built scene are rebuilt here in milliseconds.
 */
export async function generated(specs: ExerciseSpec[]): Promise<Omit<Generated, "keys">[]> {
  await warm(specs);
  return specs.map((spec) => {
    const path = cacheable(spec);
    if (!path) return generate(spec);
    const body = createBody();
    const { data } = JSON.parse(readFileSync(path, "utf8")) as { data: { sequence: Generated["sequence"] } };
    return { body, built: spec.build(body), sequence: data.sequence };
  });
}
