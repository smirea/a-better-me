/**
 * Fails when a committed generated file no longer matches what its generator writes, naming the command that
 * regenerates it. Runs in pre-commit and in CI's checks. Usage: `bun scripts/check-generated.ts`.
 */
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "sync-engine/schema";
import { DATASET, generatorHash, OUT as USDA_FOODS } from "../app-ios/scripts/usda-foods";
import { ASSETS_DIR, buildAssets } from "../server/src/assets";
import { foodNutrition, nutrientAmounts, schema } from "../shared/db/schema";
import { trackedVersion } from "./assets";
import { MUSCLE_MODEL_SOURCE, muscleModelSource, SWIFT_SCHEMA } from "./generate";

const root = join(import.meta.dir, "..");
const problems: string[] = [];

if (readFileSync(join(root, SWIFT_SCHEMA), "utf8") !== generate({ schema }).swift) {
  problems.push(`${SWIFT_SCHEMA} is stale. Run bun run generate.`);
}

if (readFileSync(join(root, MUSCLE_MODEL_SOURCE), "utf8") !== muscleModelSource()) {
  problems.push(`${MUSCLE_MODEL_SOURCE} is stale. Run bun run generate.`);
}

if (trackedVersion() !== buildAssets(ASSETS_DIR).manifest.version) {
  problems.push("app-ios/Config/Assets.xcconfig is stale. Run bun run assets version.");
}

const usda = new Database(USDA_FOODS, { readonly: true });
const meta = Object.fromEntries(
  (usda.query("SELECT key, value FROM meta").all() as { key: string; value: string }[]).map(
    (row) => [row.key, row.value],
  ),
);
const rows = usda.query("SELECT name, nutrition FROM foods").all() as {
  name: string;
  nutrition: string;
}[];
if (
  meta.version !== DATASET.version ||
  meta.sha256 !== DATASET.sha256 ||
  meta.generator !== generatorHash() ||
  rows.length !== Number(meta.foods)
) {
  problems.push("usda-foods.sqlite is stale. Run bun app-ios/scripts/usda-foods.ts.");
}
const undecodable = rows.filter(
  (row) => !foodNutrition.safeParse(JSON.parse(row.nutrition)).success,
);
if (undecodable.length > 0) {
  problems.push(
    `usda-foods.sqlite holds foods the app cannot decode: ${undecodable.map((row) => row.name).join(", ")}`,
  );
}

/** `app` marks a nutrient MacroFactor lacks, such as the sugar alcohols, which its table cannot vouch for. */
const registry: { id: string; unit: string; app?: boolean }[] = JSON.parse(
  readFileSync(join(root, "app-ios/Sources/CoreResources/Nutrition/nutrients.json"), "utf8"),
);
const research = readFileSync(join(root, "docs/research/macrofactor/nutrients.md"), "utf8")
  .split("<!-- generated:nutrients:start -->")[1]
  ?.split("<!-- generated:nutrients:end -->")[0];
const units = Object.fromEntries(
  [...(research ?? "").matchAll(/^\| `([^`]+)` +\|(?:[^|]*\|){4} *([^ |]+) *\|/gm)].map(
    ([, id, unit]) => [id!, unit!],
  ),
);
const mismatched = [
  ...registry.filter(({ id, unit, app }) => !app && units[id] !== unit).map(({ id }) => id),
  ...Object.keys(units).filter((id) => !registry.some((nutrient) => nutrient.id === id)),
];
if (mismatched.length > 0) {
  problems.push(
    `nutrients.json and docs/research/macrofactor/nutrients.md disagree on: ${mismatched.join(", ")}`,
  );
}
if (!nutrientAmounts.safeParse(Object.fromEntries(registry.map(({ id }) => [id, 1]))).success) {
  problems.push(
    "nutrients.json has an id the server validators refuse (shared/db/schema.ts nutrientAmounts).",
  );
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
