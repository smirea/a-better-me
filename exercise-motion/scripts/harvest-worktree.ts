#!/usr/bin/env bun
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MOTION_ROOT } from "./catalog-io";

/**
 * Copies newly authored or updated `exercise-motion/src/exercises/<slug>.ts` files
 * from one or more delegate worktrees into this worktree, never touching `index.ts`.
 */
function main() {
  const worktrees = process.argv.slice(2);
  if (worktrees.length === 0) {
    throw new Error("Usage: harvest-worktree.ts <worktree-path>...");
  }
  const dstDir = join(MOTION_ROOT, "src", "exercises");
  const harvested: string[] = [];

  for (const wt of worktrees) {
    const srcDir = join(wt, "exercise-motion", "src", "exercises");
    if (!existsSync(srcDir)) {
      throw new Error(`Missing exercises directory in worktree: ${srcDir}`);
    }
    for (const file of readdirSync(srcDir).sort()) {
      if (!file.endsWith(".ts") || file === "index.ts" || file.startsWith("_")) continue;
      const srcPath = join(srcDir, file);
      const dstPath = join(dstDir, file);
      const srcContent = readFileSync(srcPath, "utf8");
      const dstContent = existsSync(dstPath) ? readFileSync(dstPath, "utf8") : null;
      if (srcContent !== dstContent) {
        copyFileSync(srcPath, dstPath);
        harvested.push(file.slice(0, -3));
      }
    }
  }

  if (harvested.length === 0) {
    console.log("No new or changed exercise files found.");
    return;
  }
  console.log(`Harvested ${harvested.length} exercise(s): ${harvested.join(" ")}`);
}

main();
