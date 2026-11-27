#!/usr/bin/env bun
import { existsSync, watch } from "node:fs";
import { extname, join, normalize } from "node:path";
import { CATALOG_DIR, EXERCISE_IMAGES_DIR, MOTION_ROOT } from "./catalog-io";

const LIBRARY_DIR = join(MOTION_ROOT, "dist", "library");
const CUSTOM_MODELS_DIR = join(MOTION_ROOT, "models");
const GYM_MODELS_DIR = join(MOTION_ROOT, "dist", "gym", "models");
const PORT = Number(process.env.MOTION_PORT ?? process.argv[2] ?? 6162);

/** Everything the library is built from. A change to any of it rebuilds, and the open viewer reloads itself. */
const SOURCES = [join(MOTION_ROOT, "src"), join(MOTION_ROOT, "viewer"), join(MOTION_ROOT, "scripts"), CATALOG_DIR];
/** Saving several files at once is one rebuild, not one per file. */
const QUIET_MS = 300;

let building: Promise<void> | null = null;
let again = false;
/** The build reuses every cached exercise, so it costs a fraction of a second when nothing that matters changed. */
const build = async (): Promise<void> => {
  if (building) {
    again = true;
    return building;
  }
  building = (async () => {
    do {
      again = false;
      const started = performance.now();
      const proc = Bun.spawn(["bun", join(import.meta.dir, "build.ts"), "--library-only"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      const code = await proc.exited;
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log(code === 0 ? `Library built in ${seconds} s` : `Library build failed (exit ${code}), still serving the last one`);
    } while (again);
    building = null;
  })();
  return building;
};

const first = build();
if (!existsSync(join(LIBRARY_DIR, "index.html"))) await first;
if (!existsSync(join(LIBRARY_DIR, "index.html"))) throw new Error("The first library build failed, so there is nothing to serve.");

let timer: ReturnType<typeof setTimeout> | undefined;
for (const dir of SOURCES)
  watch(dir, { recursive: true }, (_, file) => {
    if (!file || !/\.(ts|json|css|html|pack|bin|png)$/.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(build, QUIET_MS);
  });

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
};

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    let baseDir = LIBRARY_DIR;
    let rel = pathname;
    if (pathname.startsWith("/exercise-images/")) {
      baseDir = EXERCISE_IMAGES_DIR;
      rel = pathname.slice("/exercise-images/".length);
    } else if (pathname.startsWith("/gym-models/")) {
      rel = pathname.slice("/gym-models/".length);
      const safeModel = normalize(rel).replace(/^(\.\.[/\\])+/, "").replace(/^\/+/, "");
      baseDir = existsSync(join(CUSTOM_MODELS_DIR, safeModel)) ? CUSTOM_MODELS_DIR : GYM_MODELS_DIR;
    }
    const safeRel = normalize(rel).replace(/^(\.\.[/\\])+/, "").replace(/^\/+/, "");
    const filePath = join(baseDir, safeRel);
    if (!existsSync(filePath)) return new Response("Not found", { status: 404 });
    return new Response(Bun.file(filePath), {
      headers: {
        "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-cache",
        "access-control-allow-origin": "*",
      },
    });
  },
});

console.log(`Exercise Motion Library serving at http://localhost:${server.port}/, rebuilding on changes`);
