#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(import.meta.dir, "..", "dist", "gym");
if (!existsSync(join(OUT_DIR, "index.html"))) {
  throw new Error("Missing dist/gym/index.html — run `bun run gym` first.");
}

const port = Number(process.argv[2] ?? process.env.PORT ?? 6160);
const server = Bun.serve({
  port,
  async fetch(req) {
    const pathname = new URL(req.url).pathname;
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    if (rel.includes("..")) return new Response("Forbidden", { status: 403 });
    const file = Bun.file(join(OUT_DIR, rel));
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });
    const headers: Record<string, string> = {};
    if (rel.endsWith(".glb")) headers["Content-Type"] = "model/gltf-binary";
    else if (rel.endsWith(".html")) headers["Content-Type"] = "text/html; charset=utf-8";
    else if (rel.endsWith(".json")) headers["Content-Type"] = "application/json";
    return new Response(file, { headers });
  },
});

console.log(`3D Gym running at http://127.0.0.1:${server.port}/`);
