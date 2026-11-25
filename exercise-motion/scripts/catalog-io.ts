import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExerciseSpec } from "../src/exercise";
import type { Muscle } from "../src/muscles";

export const MOTION_ROOT = join(import.meta.dir, "..");
export const REPO_ROOT = join(MOTION_ROOT, "..");
export const CATALOG_DIR = join(REPO_ROOT, "app-ios/Sources/CoreResources/Catalog");
export const EXERCISE_IMAGES_DIR = join(REPO_ROOT, "app-ios/Assets/ExerciseImages");

export interface AppCatalogExercise {
  id: string;
  name: string;
  alternativeNames: string[];
  type: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  primaryMuscleDetails: string[];
  secondaryMuscleDetails: string[];
  movementPatterns: string[];
  region: string | null;
  laterality: "bilateral" | "unilateral" | "asymmetrical";
  metrics: string[];
  resistanceEquipment: string[];
  supportEquipment: string[];
  category: string;
  rangeOfMotion: number;
  stability: number;
  primaryJointActions: string[];
  secondaryJointActions: string[];
  bodyweightFraction: number;
  searchBoost: number;
  hasInstructions: boolean;
  images: string[];
  selection?: {
    stretchedMuscles: string[];
    exerciseGroups?: string[];
    exclusionGroupings?: string[];
  };
}

let cachedExercises: AppCatalogExercise[] | null = null;
let cachedMdIndex: Record<string, [number, number]> | null = null;
let cachedMdPack: Buffer | null = null;
let cachedSlugs: Map<string, string> | null = null;

export function loadAppCatalog(): AppCatalogExercise[] {
  if (!cachedExercises) {
    cachedExercises = JSON.parse(
      readFileSync(join(CATALOG_DIR, "exercises.json"), "utf8"),
    ) as AppCatalogExercise[];
  }
  return cachedExercises;
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("°", "-deg-")
    .replaceAll("'", "")
    .replaceAll("’", "")
    .replaceAll('"', "")
    .replaceAll("“", "")
    .replaceAll("”", "")
    .replaceAll("/", "-")
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Stable, collision-free kebab-case slug for every catalogId in `exercises.json`. */
export function catalogSlugMap(): Map<string, string> {
  if (cachedSlugs) return cachedSlugs;
  const exercises = loadAppCatalog();
  const map = new Map<string, string>();
  const used = new Map<string, string>();
  // Keep the 3 existing canonical slugs fixed.
  const pinned: Record<string, string> = {
    "1a25c6f170d8800a86efdcb6f902b9a9": "smith-machine-back-squat",
    "1a35c6f170d880489b7be1d31faff56b": "dumbbell-romanian-deadlift",
    "19f5c6f170d8808bb424e98de4472a7e": "barbell-bench-press",
  };
  for (const [cid, slug] of Object.entries(pinned)) {
    map.set(cid, slug);
    used.set(slug, cid);
  }
  for (const ex of exercises) {
    if (map.has(ex.id)) continue;
    let base = slugifyName(ex.name);
    if (!base) base = `exercise-${ex.id.slice(0, 8)}`;
    let slug = base;
    if (used.has(slug)) {
      slug = `${base}-${ex.id.slice(0, 6)}`;
    }
    map.set(ex.id, slug);
    used.set(slug, ex.id);
  }
  cachedSlugs = map;
  return map;
}

export function readInstructionMarkdown(catalogId: string): string | null {
  if (!cachedMdIndex) {
    cachedMdIndex = JSON.parse(readFileSync(join(CATALOG_DIR, "markdown.json"), "utf8"));
  }
  if (!cachedMdPack) {
    cachedMdPack = readFileSync(join(CATALOG_DIR, "markdown.pack"));
  }
  const entry = cachedMdIndex![`Instructions/${catalogId}`];
  if (!entry) return null;
  return cachedMdPack.subarray(entry[0], entry[0] + entry[1]).toString("utf8").trim();
}

export function exerciseImageFiles(ex: AppCatalogExercise): string[] {
  return ex.images
    .map((stem) => join(EXERCISE_IMAGES_DIR, `${stem}.webp`))
    .filter((file) => existsSync(file));
}

export async function loadSpec(slugOrPath: string): Promise<ExerciseSpec> {
  const filePath = slugOrPath.endsWith(".ts")
    ? resolve(slugOrPath)
    : join(MOTION_ROOT, "src", "exercises", `${slugOrPath}.ts`);
  if (!existsSync(filePath)) throw new Error(`Missing exercise file: ${filePath}`);
  const mod = (await import(filePath)) as Record<string, unknown>;
  const spec = (mod.spec ??
    Object.values(mod).find(
      (v): v is ExerciseSpec =>
        typeof v === "object" && v !== null && "id" in v && "catalogId" in v && "build" in v,
    )) as ExerciseSpec | undefined;
  if (!spec) throw new Error(`${filePath}: no ExerciseSpec export found`);
  return spec;
}
