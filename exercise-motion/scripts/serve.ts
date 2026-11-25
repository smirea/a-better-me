#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { EXERCISE_IMAGES_DIR, MOTION_ROOT } from "./catalog-io";

const LIBRARY_DIR = join(MOTION_ROOT, "dist", "library");
const GYM_MODELS_DIR = join(MOTION_ROOT, "dist", "gym", "models");
const PORT = Number(process.env.MOTION_PORT ?? process.argv[2] ?? 6162);

if (!existsSync(join(LIBRARY_DIR, "index.html"))) {
  throw new Error("Missing exercise-motion/dist/library/index.html — run `bun run motion` first.");
}

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
      baseDir = GYM_MODELS_DIR;
      rel = pathname.slice("/gym-models/".length);
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

console.log(`Exercise Motion Library serving at http://localhost:${server.port}/`);
