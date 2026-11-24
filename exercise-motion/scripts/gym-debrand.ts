#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, NodeIO, type Material, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import {
  classifySubgroup,
  classifyZone,
  debrandEquipmentName,
  type EquipmentMeta,
} from "../gym/catalog";
import { isBrandYellowFactor, TEXTURE_ACTION_BY_HASH } from "../gym/debrand-rules";
import type { RawCatalogItem } from "./gym-fetch";

const ROOT = join(import.meta.dir, "..");
const CACHE_DIR = join(ROOT, ".cache", "gym");
const RAW_DIR = join(CACHE_DIR, "raw");
const AUDIT_IMG_DIR = join(CACHE_DIR, "audit", "images");
const CLEAN_TEX_DIR = join(CACHE_DIR, "clean-textures");
const OUT_DIR = join(ROOT, "dist", "gym");
const OUT_MODELS_DIR = join(OUT_DIR, "models");

function sha12(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 12);
}

async function runMagick(args: string[]): Promise<void> {
  const proc = Bun.spawn(["magick", ...args], { stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`magick failed (${code}): ${err}\nargs: ${args.join(" ")}`);
  }
}

async function imageDimensions(path: string): Promise<[number, number]> {
  const proc = Bun.spawn(["magick", "identify", "-format", "%w %h", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`identify failed for ${path}`);
  const out = (await new Response(proc.stdout).text()).trim();
  const [w, h] = out.split(/\s+/).map(Number);
  return [w || 256, h || 256];
}

async function generateCleanConsoleScreen(outPath: string): Promise<void> {
  const svgPath = join(CLEAN_TEX_DIR, "_screen.svg");
  // Pure vector dashboard (no text nodes) so ImageMagick renders identically with no font config.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 512 320">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#111620"/>
        <stop offset="100%" stop-color="#090c12"/>
      </linearGradient>
      <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5a98ff"/>
        <stop offset="100%" stop-color="#224ea6"/>
      </linearGradient>
    </defs>
    <rect width="512" height="320" fill="url(#bg)"/>
    <rect x="20" y="16" width="472" height="28" rx="6" fill="#181f2c"/>
    <circle cx="36" cy="30" r="5" fill="#3db892"/>
    <rect x="50" y="26" width="84" height="8" rx="4" fill="#333e54"/>
    <rect x="424" y="26" width="52" height="8" rx="4" fill="#2a3346"/>
    <g fill="#151b26" stroke="#253045" stroke-width="1.5">
      <rect x="20" y="58" width="148" height="102" rx="10"/>
      <rect x="182" y="58" width="148" height="102" rx="10"/>
      <rect x="344" y="58" width="148" height="102" rx="10"/>
      <rect x="20" y="174" width="472" height="128" rx="10"/>
    </g>
    <circle cx="94" cy="112" r="32" fill="none" stroke="#253045" stroke-width="8"/>
    <path d="M 94 80 A 32 32 0 1 1 66 128" fill="none" stroke="#4d8bf5" stroke-width="8" stroke-linecap="round"/>
    <circle cx="256" cy="112" r="32" fill="none" stroke="#253045" stroke-width="8"/>
    <path d="M 256 80 A 32 32 0 1 1 286 124" fill="none" stroke="#3db892" stroke-width="8" stroke-linecap="round"/>
    <path d="M 362 118 L 384 118 L 394 94 L 406 134 L 418 88 L 430 124 L 442 112 L 474 112" fill="none" stroke="#e06c4d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="url(#bar)">
      <rect x="38" y="252" width="22" height="36" rx="3"/>
      <rect x="68" y="240" width="22" height="48" rx="3"/>
      <rect x="98" y="226" width="22" height="62" rx="3"/>
      <rect x="128" y="216" width="22" height="72" rx="3"/>
      <rect x="158" y="232" width="22" height="56" rx="3"/>
      <rect x="188" y="210" width="22" height="78" rx="3"/>
      <rect x="218" y="200" width="22" height="88" rx="3"/>
      <rect x="248" y="220" width="22" height="68" rx="3"/>
      <rect x="278" y="228" width="22" height="60" rx="3"/>
      <rect x="308" y="208" width="22" height="80" rx="3"/>
      <rect x="338" y="222" width="22" height="66" rx="3"/>
      <rect x="368" y="236" width="22" height="52" rx="3"/>
      <rect x="398" y="246" width="22" height="42" rx="3"/>
      <rect x="428" y="256" width="22" height="32" rx="3"/>
      <rect x="458" y="264" width="16" height="24" rx="3"/>
    </g>
  </svg>`;
  writeFileSync(svgPath, svg);
  await runMagick([svgPath, "-quality", "86", outPath]);
}

async function generateBrushedMetal(outPath: string, size = 256): Promise<void> {
  await runMagick([
    "-size",
    `${size}x${size}`,
    "xc:#8a9099",
    "-attenuate",
    "0.18",
    "+noise",
    "Gaussian",
    "-colorspace",
    "Gray",
    "-motion-blur",
    "0x18+0",
    "-level",
    "15%,88%",
    "-quality",
    "86",
    outPath,
  ]);
}

async function generateRadialChrome(outPath: string, size = 256): Promise<void> {
  await runMagick([
    "-size",
    `${size}x${size}`,
    "radial-gradient:#c8cdd4-#686e78",
    "-quality",
    "86",
    outPath,
  ]);
}

interface CleanTextureResult {
  bytes: Uint8Array;
  mimeType: string;
}

async function buildCleanTextureCache(): Promise<Map<string, CleanTextureResult>> {
  mkdirSync(CLEAN_TEX_DIR, { recursive: true });
  const cache = new Map<string, CleanTextureResult>();

  // Shared synthesized replacements
  const darkPath = join(CLEAN_TEX_DIR, "_solid-dark.jpg");
  const blackPath = join(CLEAN_TEX_DIR, "_solid-black.jpg");
  const steelPath = join(CLEAN_TEX_DIR, "_brushed-steel.jpg");
  const radialPath = join(CLEAN_TEX_DIR, "_radial-chrome.jpg");
  const screenPath = join(CLEAN_TEX_DIR, "_clean-screen.jpg");

  await Promise.all([
    runMagick(["-size", "16x16", "xc:#22252b", "-quality", "85", darkPath]),
    runMagick(["-size", "16x16", "xc:#101215", "-quality", "85", blackPath]),
    generateBrushedMetal(steelPath, 256),
    generateRadialChrome(radialPath, 256),
    generateCleanConsoleScreen(screenPath),
  ]);

  const sharedBytes = {
    "fill-dark": { bytes: new Uint8Array(readFileSync(darkPath)), mimeType: "image/jpeg" },
    "fill-black": { bytes: new Uint8Array(readFileSync(blackPath)), mimeType: "image/jpeg" },
    "fill-steel": { bytes: new Uint8Array(readFileSync(steelPath)), mimeType: "image/jpeg" },
    "cap-chrome": { bytes: new Uint8Array(readFileSync(radialPath)), mimeType: "image/jpeg" },
    screen: { bytes: new Uint8Array(readFileSync(screenPath)), mimeType: "image/jpeg" },
  };

  // Map every audited source image file by hash
  const auditFiles = new Map<string, string>();
  if (existsSync(AUDIT_IMG_DIR)) {
    for (const file of readdirSync(AUDIT_IMG_DIR)) {
      const m = file.match(/^\d+_([0-9a-f]+)\.(png|jpg)$/);
      if (m) auditFiles.set(m[1], join(AUDIT_IMG_DIR, file));
    }
  }

  // Process every hash that needs per-image surgical editing (or shared replacement)
  const jobs: Promise<void>[] = [];
  for (const [hash, action] of TEXTURE_ACTION_BY_HASH) {
    if (action === "hide" || action === "flat-normal") continue;
    if (action in sharedBytes) {
      cache.set(hash, sharedBytes[action as keyof typeof sharedBytes]);
      continue;
    }

    const src = auditFiles.get(hash);
    if (!src) continue;
    const isPng = src.endsWith(".png");
    const outPath = join(CLEAN_TEX_DIR, `${hash}_${action}.${isPng ? "png" : "jpg"}`);

    jobs.push(
      (async () => {
        if (!existsSync(outPath) || process.argv.includes("--rebuild-textures")) {
          const [w, h] = await imageDimensions(src);
          const cx = Math.round(w / 2);
          const cy = Math.round(h / 2);

          switch (action) {
            case "plate-bumper": {
              // Paint out top and bottom brand arcs while keeping left/right "20 KG" and rubber finish.
              const yTopEnd = Math.round(h * 0.34);
              const yBotStart = Math.round(h * 0.66);
              const xL = Math.round(w * 0.16);
              const xR = Math.round(w * 0.84);
              await runMagick([
                src,
                "-fill",
                "#141517",
                "-draw",
                `rectangle ${xL},0 ${xR},${yTopEnd} rectangle ${xL},${yBotStart} ${xR},${h}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "plate-grip": {
              // Curved brand wordmarks run vertically along outer left (0..31%) and outer right (69..100%)
              // while grip cutouts are top/bottom and "20" sits inside. Paint curved side wedges matching
              // the plate's metallic grey rim (#7c7e80).
              const rOuter = Math.round(w * 0.45);
              const rInner = Math.round(w * 0.31);
              const rMid = Math.round((rOuter + rInner) / 2);
              const strokeW = Math.max(10, Math.round(w * 0.15));
              const x0 = cx - rMid;
              const y0 = cy - rMid;
              const x1 = cx + rMid;
              const y1 = cy + rMid;
              await runMagick([
                src,
                "-fill",
                "none",
                "-stroke",
                "#797c7f",
                "-strokewidth",
                String(strokeW),
                "-draw",
                `arc ${x0},${y0} ${x1},${y1} -68,68 arc ${x0},${y0} ${x1},${y1} 112,248`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "plate-blue": {
              const xL = Math.round(w * 0.25);
              const xR = Math.round(w * 0.75);
              await runMagick([
                src,
                "-fill",
                "#224494",
                "-draw",
                `rectangle ${xL},${Math.round(h * 0.08)} ${xR},${Math.round(h * 0.28)} rectangle ${xL},${Math.round(h * 0.72)} ${xR},${Math.round(h * 0.92)}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "cap-grey": {
              // Paint top 32% and bottom 32% solid matching grey (#848688) while keeping center weight number.
              const topH = Math.round(h * 0.33);
              const botY = Math.round(h * 0.67);
              await runMagick([
                src,
                "-fill",
                "#86888b",
                "-draw",
                `rectangle 0,0 ${w},${topH} rectangle 0,${botY} ${w},${h}`,
                "-resize",
                "256x256>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "cap-brushed": {
              // Mask top & bottom curved wordmarks on brushed stainless radial caps with matching radial steel.
              const topH = Math.round(h * 0.32);
              const botY = Math.round(h * 0.68);
              await runMagick([
                src,
                "(",
                "-size",
                `${w}x${h}`,
                "radial-gradient:#d2d5da-#80858c",
                "(",
                "-size",
                `${w}x${h}`,
                "xc:black",
                "-fill",
                "white",
                "-draw",
                `rectangle 0,0 ${w},${topH} rectangle 0,${botY} ${w},${h}`,
                ")",
                "-alpha",
                "off",
                "-compose",
                "CopyOpacity",
                "-composite",
                ")",
                "-compose",
                "Over",
                "-composite",
                "-resize",
                "256x256>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "medball": {
              // Mask upper logo patch above the stitching while preserving stitching & weight number.
              await runMagick([
                src,
                "-fill",
                "#1d1f22",
                "-draw",
                `roundRectangle ${Math.round(w * 0.28)},${Math.round(h * 0.21)} ${Math.round(w * 0.72)},${Math.round(h * 0.36)} 10,10`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "mat-quilted": {
              await runMagick([
                src,
                "-fill",
                "#1c1e22",
                "-draw",
                `rectangle ${Math.round(w * 0.08)},${Math.round(h * 0.24)} ${Math.round(w * 0.38)},${Math.round(h * 0.39)}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "mat-stripe": {
              await runMagick([
                src,
                "-fill",
                "#191b1f",
                "-draw",
                `rectangle ${Math.round(w * 0.28)},${Math.round(h * 0.42)} ${Math.round(w * 0.72)},${Math.round(h * 0.58)}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "mat-yellow": {
              await runMagick([
                src,
                "-modulate",
                "45,8,100",
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "placard-vertical": {
              // Mask bottom 21% containing QR code + brand URL.
              const yCut = Math.round(h * 0.79);
              await runMagick([
                src,
                "-fill",
                "#0b0c0e",
                "-draw",
                `rectangle 0,${yCut} ${w},${h}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "placard-url": {
              const yCut = Math.round(h * 0.87);
              await runMagick([
                src,
                "-fill",
                "#1e2024",
                "-draw",
                `rectangle 0,${yCut} ${w},${h}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "placard-horizontal": {
              const yCut = Math.round(h * 0.91);
              await runMagick([
                src,
                "-fill",
                "#0b0c0e",
                "-draw",
                `rectangle 0,${yCut} ${w},${h}`,
                "-resize",
                "512x512>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
            case "plaque-desat": {
              // Neutralize bright brand-yellow outer border ring & text to crisp silver-white.
              await runMagick([
                src,
                "-modulate",
                "92,8,100",
                "-resize",
                "256x256>",
                ...(isPng ? [] : ["-quality", "84"]),
                outPath,
              ]);
              break;
            }
          }
        }
        cache.set(hash, {
          bytes: new Uint8Array(readFileSync(outPath)),
          mimeType: isPng ? "image/png" : "image/jpeg",
        });
      })(),
    );
  }

  // Run magick jobs in bounded batches of 12
  for (let i = 0; i < jobs.length; i += 12) {
    await Promise.all(jobs.slice(i, i + 12));
  }

  // Also pre-downscale any oversized kept textures (>512px) so GLBs stay lean
  const downscaleDir = join(CLEAN_TEX_DIR, "kept");
  mkdirSync(downscaleDir, { recursive: true });
  const keptJobs: Promise<void>[] = [];
  for (const [hash, src] of auditFiles) {
    if (TEXTURE_ACTION_BY_HASH.has(hash)) continue;
    const isPng = src.endsWith(".png");
    const outPath = join(downscaleDir, `${hash}.${isPng ? "png" : "jpg"}`);
    keptJobs.push(
      (async () => {
        const rawBytes = readFileSync(src);
        if (rawBytes.length < 48_000) {
          cache.set(hash, {
            bytes: new Uint8Array(rawBytes),
            mimeType: isPng ? "image/png" : "image/jpeg",
          });
          return;
        }
        if (!existsSync(outPath)) {
          await runMagick([
            src,
            "-resize",
            "512x512>",
            ...(isPng ? ["-strip"] : ["-strip", "-quality", "80"]),
            outPath,
          ]);
        }
        cache.set(hash, {
          bytes: new Uint8Array(readFileSync(outPath)),
          mimeType: isPng ? "image/png" : "image/jpeg",
        });
      })(),
    );
  }
  for (let i = 0; i < keptJobs.length; i += 12) {
    await Promise.all(keptJobs.slice(i, i + 12));
  }

  console.log(`Prepared ${cache.size} clean/optimized textures in ${CLEAN_TEX_DIR}`);
  return cache;
}

function countTriangles(doc: Document): number {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      tris += (idx?.getCount() ?? pos?.getCount() ?? 0) / 3;
    }
  }
  return Math.round(tris);
}

/** Compute world-space AABB across all meshes in the root scene, accounting for node transforms. */
function computeSceneBounds(doc: Document): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const pMin = pos.getMin([0, 0, 0]);
        const pMax = pos.getMax([0, 0, 0]);
        // Transform the 8 corners of the primitive's local AABB by the node's world matrix.
        for (let ix = 0; ix < 2; ix++) {
          const x = ix === 0 ? pMin[0] : pMax[0];
          for (let iy = 0; iy < 2; iy++) {
            const y = iy === 0 ? pMin[1] : pMax[1];
            for (let iz = 0; iz < 2; iz++) {
              const z = iz === 0 ? pMin[2] : pMax[2];
              const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
              const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
              const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
              if (wx < min[0]) min[0] = wx;
              if (wy < min[1]) min[1] = wy;
              if (wz < min[2]) min[2] = wz;
              if (wx > max[0]) max[0] = wx;
              if (wy > max[1]) max[1] = wy;
              if (wz > max[2]) max[2] = wz;
            }
          }
        }
      }
    });
  }

  if (!Number.isFinite(min[0])) {
    return { min: [0, 0, 0], max: [1, 1, 1] };
  }
  return { min, max };
}

/** Pick an appropriate triangle budget based on physical volume/category so all 283 run at 60 FPS. */
/** Drop vertices no longer referenced after simplification so compressed GLBs stay tiny. */
function compactPrimitive(doc: Document, prim: Primitive, newIndices: Uint32Array): void {
  const pos = prim.getAttribute("POSITION");
  if (!pos) return;
  const oldCount = pos.getCount();
  const remap = new Int32Array(oldCount).fill(-1);
  let nextId = 0;
  const remapped = new Uint32Array(newIndices.length);
  for (let i = 0; i < newIndices.length; i++) {
    const oldIdx = newIndices[i];
    let mapped = remap[oldIdx];
    if (mapped === -1) {
      mapped = nextId++;
      remap[oldIdx] = mapped;
    }
    remapped[i] = mapped;
  }

  for (const semantic of prim.listSemantics()) {
    const acc = prim.getAttribute(semantic);
    if (!acc) continue;
    const src = acc.getArray();
    if (!src) continue;
    const itemSize = acc.getElementSize();
    const dst = new Float32Array(nextId * itemSize);
    for (let oldIdx = 0; oldIdx < oldCount; oldIdx++) {
      const mapped = remap[oldIdx];
      if (mapped === -1) continue;
      const s = oldIdx * itemSize;
      const d = mapped * itemSize;
      for (let k = 0; k < itemSize; k++) dst[d + k] = src[s + k];
    }
    const nextAcc = doc.createAccessor().setType(acc.getType()).setArray(dst);
    prim.setAttribute(semantic, nextAcc);
  }

  const idxAcc = prim.getIndices();
  if (idxAcc) {
    idxAcc.setArray(nextId <= 65535 ? new Uint16Array(remapped) : remapped);
  }
}

function recomputeVertexNormals(doc: Document, prim: Primitive): void {
  const pos = prim.getAttribute("POSITION");
  const idx = prim.getIndices();
  if (!pos || !idx) return;
  const pArr = pos.getArray();
  const iArr = idx.getArray();
  if (!pArr || !iArr) return;
  const nArr = new Float32Array(pos.getCount() * 3);
  for (let t = 0; t < iArr.length; t += 3) {
    const a = iArr[t] * 3;
    const b = iArr[t + 1] * 3;
    const c = iArr[t + 2] * 3;
    const ax = pArr[b] - pArr[a];
    const ay = pArr[b + 1] - pArr[a + 1];
    const az = pArr[b + 2] - pArr[a + 2];
    const bx = pArr[c] - pArr[a];
    const by = pArr[c + 1] - pArr[a + 1];
    const bz = pArr[c + 2] - pArr[a + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    nArr[a] += nx;
    nArr[a + 1] += ny;
    nArr[a + 2] += nz;
    nArr[b] += nx;
    nArr[b + 1] += ny;
    nArr[b + 2] += nz;
    nArr[c] += nx;
    nArr[c + 1] += ny;
    nArr[c + 2] += nz;
  }
  for (let v = 0; v < nArr.length; v += 3) {
    const len = Math.hypot(nArr[v], nArr[v + 1], nArr[v + 2]) || 1;
    nArr[v] /= len;
    nArr[v + 1] /= len;
    nArr[v + 2] /= len;
  }
  prim.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nArr));
}

function targetTrianglesFor(size: [number, number, number], zone: string): number {
  const footprint = size[0] * size[2];
  if (zone === "functional" && footprint > 15) return 18_000;
  if (zone === "cables" && footprint > 6) return 18_000;
  if (footprint > 6) return 14_000;
  if (footprint > 2.5) return 11_000;
  if (footprint > 0.8) return 8_500;
  return 6_000;
}

/**
 * pCon's GLB exporter occasionally omits trailing image-chunk bytes from `buffers[0].byteLength`
 * and the geometry bufferViews (`target` 34962/34963), shifting vertex/index offsets while the
 * binary chunk itself is intact. Detect that mismatch and patch the JSON header before reading.
 */
function repairPconGlb(raw: Buffer): Uint8Array {
  if (raw.subarray(0, 4).toString("ascii") !== "glTF") return new Uint8Array(raw);
  const jLen = raw.readUInt32LE(12);
  const binStart = 20 + jLen + 8;
  const binChunkLen = raw.readUInt32LE(20 + jLen);
  const gltf = JSON.parse(raw.subarray(20, 20 + jLen).toString("utf8")) as {
    buffers?: { byteLength: number }[];
    bufferViews?: { byteOffset?: number; byteLength: number; target?: number }[];
    accessors?: { bufferView?: number; byteOffset?: number; min?: number[]; max?: number[] }[];
  };
  const declared = gltf.buffers?.[0]?.byteLength ?? binChunkLen;
  const rawDelta = binChunkLen - declared;
  if (rawDelta <= 4 || !gltf.bufferViews || !gltf.buffers?.[0]) return new Uint8Array(raw);

  // Pick the exact 4-byte-aligned delta (accounting for up to 3 bytes of GLB chunk padding).
  let delta = rawDelta & ~3;
  const posAcc = gltf.accessors?.find((a) => a.min?.length === 3 && a.max?.length === 3);
  if (posAcc && posAcc.bufferView != null) {
    const bv = gltf.bufferViews[posAcc.bufferView];
    for (const pad of [0, 1, 2, 3]) {
      const candidate = rawDelta - pad;
      if (candidate <= 0) continue;
      const off = binStart + (bv.byteOffset ?? 0) + (posAcc.byteOffset ?? 0) + candidate;
      if (off + 12 > raw.length) continue;
      const x = raw.readFloatLE(off);
      const y = raw.readFloatLE(off + 4);
      const z = raw.readFloatLE(off + 8);
      if (
        x >= posAcc.min![0] - 1e-2 &&
        x <= posAcc.max![0] + 1e-2 &&
        y >= posAcc.min![1] - 1e-2 &&
        y <= posAcc.max![1] + 1e-2 &&
        z >= posAcc.min![2] - 1e-2 &&
        z <= posAcc.max![2] + 1e-2
      ) {
        delta = candidate;
        break;
      }
    }
  }

  for (const bv of gltf.bufferViews) {
    if (bv.target === 34962 || bv.target === 34963) {
      bv.byteOffset = (bv.byteOffset ?? 0) + delta;
    }
  }
  gltf.buffers[0].byteLength = binChunkLen;

  const newJsonBuf = Buffer.from(JSON.stringify(gltf), "utf8");
  const padLen = (4 - (newJsonBuf.length % 4)) % 4;
  const paddedJson = padLen
    ? Buffer.concat([newJsonBuf, Buffer.alloc(padLen, 0x20)])
    : newJsonBuf;
  const binChunk = raw.subarray(20 + jLen);
  const totalLen = 12 + 8 + paddedJson.length + binChunk.length;
  const out = Buffer.allocUnsafe(totalLen);
  out.write("glTF", 0, "ascii");
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(paddedJson.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  paddedJson.copy(out, 20);
  binChunk.copy(out, 20 + paddedJson.length);
  return new Uint8Array(out);
}

async function processModel(
  io: NodeIO,
  item: RawCatalogItem,
  cleanTextures: Map<string, CleanTextureResult>,
): Promise<EquipmentMeta | null> {
  const rawPath = join(RAW_DIR, `${item.id}.glb`);
  if (!existsSync(rawPath)) return null;

  const doc = await io.readBinary(repairPconGlb(readFileSync(rawPath)));
  const asset = doc.getRoot().getAsset();
  asset.copyright = undefined;
  asset.generator = "a-better-me gym-debrand";

  // 1. Identify which textures are hidden logo decals vs flat normals vs replaced images.
  const hideMaterials = new Set<Material>();
  for (const mat of doc.getRoot().listMaterials()) {
    const baseTex = mat.getBaseColorTexture();
    if (baseTex) {
      const img = baseTex.getImage();
      if (img) {
        const hash = sha12(img);
        const action = TEXTURE_ACTION_BY_HASH.get(hash);
        if (action === "hide") {
          hideMaterials.add(mat);
        }
      }
    }
    const normTex = mat.getNormalTexture();
    if (normTex) {
      const img = normTex.getImage();
      if (img && TEXTURE_ACTION_BY_HASH.get(sha12(img)) === "flat-normal") {
        mat.setNormalTexture(null);
      }
    }
    // Neutralize bright Technogym-yellow paint materials to brushed dark slate titanium.
    if (!baseTex) {
      const factor = mat.getBaseColorFactor();
      if (isBrandYellowFactor(factor)) {
        mat.setBaseColorFactor([0.23, 0.27, 0.34, 1]);
        mat.setMetallicFactor(0.35);
        mat.setRoughnessFactor(0.42);
      } else if (factor[0] < 0.025 && factor[1] < 0.025 && factor[2] < 0.025) {
        // Lift zero-albedo Vantablack powder-coat steel to satin charcoal steel so frames read crisply.
        mat.setBaseColorFactor([0.055, 0.06, 0.072, factor[3] ?? 1]);
        mat.setMetallicFactor(Math.max(mat.getMetallicFactor(), 0.26));
        mat.setRoughnessFactor(Math.min(mat.getRoughnessFactor(), 0.45));
      }
    }
  }

  // 2. Delete primitives assigned to transparent logo decal materials (and extruded 3D text on mats).
  for (const mesh of doc.getRoot().listMeshes()) {
    const toRemove: Primitive[] = [];
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (mat && hideMaterials.has(mat)) {
        toRemove.push(prim);
        continue;
      }
      if (item.id === "stretchingmat" && !mat?.getBaseColorTexture()) {
        const pos = prim.getAttribute("POSITION");
        if (pos) {
          const min = pos.getMin([0, 0, 0]);
          const max = pos.getMax([0, 0, 0]);
          const tris = (prim.getIndices()?.getCount() ?? pos.getCount()) / 3;
          const thin = Math.min(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
          const wide = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
          if (tris > 200 && tris < 5000 && thin < 0.008 && wide > 0.15) toRemove.push(prim);
        }
      }
    }
    for (const prim of toRemove) prim.dispose();
  }

  // 3. Swap all remaining textures with their debranded & optimized versions.
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    const hash = sha12(img);
    const replacement = cleanTextures.get(hash);
    if (replacement) {
      tex.setImage(replacement.bytes);
      tex.setMimeType(replacement.mimeType);
    }
  }

  // 4. Normalize transform so every piece rests flush on y = 0 and centers at x = 0, z = 0.
  const bounds = computeSceneBounds(doc);
  const width = Math.max(0.05, bounds.max[0] - bounds.min[0]);
  const height = Math.max(0.05, bounds.max[1] - bounds.min[1]);
  const depth = Math.max(0.05, bounds.max[2] - bounds.min[2]);
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const minY = bounds.min[1];

  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (scene) {
    const wrapper = doc.createNode("root").setTranslation([-cx, -minY, -cz]);
    const children = scene.listChildren();
    for (const child of children) {
      wrapper.addChild(child);
    }
    scene.addChild(wrapper);
  }

  // 5. Per-primitive silhouette-preserving simplification + vertex compaction + meshopt compression.
  // Never simplify small primitives (<=4k tris) so thin beams, screens, and belts stay 100% intact.
  const zone = classifyZone(item.id, item.line);
  const size: [number, number, number] = [+width.toFixed(3), +height.toFixed(3), +depth.toFixed(3)];
  const beforeTris = countTriangles(doc);
  const targetTris = targetTrianglesFor(size, zone);

  await doc.transform(dedup());
  let strippedAnyNormals = false;
  if (beforeTris > targetTris * 1.15) {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const tris = (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION")?.getCount() ?? 0) / 3;
        if (tris > 12_000) {
          prim.setAttribute("NORMAL", null);
          strippedAnyNormals = true;
        }
      }
    }
  }
  await doc.transform(weld());

  if (beforeTris > targetTris * 1.15) {
    // Allocate triangle budget proportionally across dense primitives (>4k tris), keeping a solid floor.
    const densePrims: { prim: Primitive; tris: number }[] = [];
    let fixedTris = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        const pos = prim.getAttribute("POSITION");
        if (!idx || !pos) continue;
        const tris = idx.getCount() / 3;
        if (tris <= 4_000) fixedTris += tris;
        else densePrims.push({ prim, tris });
      }
    }
    const denseTotal = densePrims.reduce((s, d) => s + d.tris, 0);
    const denseBudget = Math.max(4_000 * densePrims.length, targetTris - fixedTris);
    const scale = Math.min(1, denseBudget / Math.max(1, denseTotal));

    for (const { prim, tris } of densePrims) {
      const idx = prim.getIndices()!;
      const pos = prim.getAttribute("POSITION")!;
      const targetPrimTris = Math.max(4_000, Math.round(tris * scale));
      if (targetPrimTris >= tris * 0.92) continue;
      const srcIdx = new Uint32Array(idx.getArray()!);
      const srcPos = new Float32Array(pos.getArray()!);
      // Tight error (0.004) + LockBorder preserves every structural beam and silhouette cleanly.
      const [dstIdx] = MeshoptSimplifier.simplify(
        srcIdx,
        srcPos,
        3,
        targetPrimTris * 3,
        0.004,
        ["LockBorder"],
      );
      if (dstIdx.length > 0 && dstIdx.length < srcIdx.length) {
        compactPrimitive(doc, prim, dstIdx);
      }
    }
  }

  if (strippedAnyNormals) {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getAttribute("NORMAL")) continue;
        recomputeVertexNormals(doc, prim);
      }
    }
  }

  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  const outBin = await io.writeBinary(doc);
  writeFileSync(join(OUT_MODELS_DIR, `${item.id}.glb`), outBin);

  const name = debrandEquipmentName(item.id, item.label, item.line);
  return {
    id: item.id,
    name,
    zone,
    subgroup: classifySubgroup(name, zone),
    size,
    tris: countTriangles(doc),
    bytes: outBin.byteLength,
  };
}

async function main() {
  mkdirSync(OUT_MODELS_DIR, { recursive: true });
  const catalogPath = join(CACHE_DIR, "catalog.json");
  if (!existsSync(catalogPath)) {
    throw new Error("Missing catalog.json — run `bun exercise-motion/scripts/gym-fetch.ts` first.");
  }
  const catalog = (await Bun.file(catalogPath).json()) as RawCatalogItem[];
  const cleanTextures = await buildCleanTextureCache();

  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
  });

  const started = performance.now();
  const manifest: EquipmentMeta[] = [];
  let totalBytes = 0;
  let totalTris = 0;
  let done = 0;

  for (const item of catalog) {
    try {
      const meta = await processModel(io, item, cleanTextures);
      if (meta) {
        manifest.push(meta);
        totalBytes += meta.bytes;
        totalTris += meta.tris;
      }
    } catch (error) {
      console.error(`FAILED ${item.id}:`, error);
    }
    done++;
    if (done % 25 === 0 || done === catalog.length) {
      console.log(
        `[${done}/${catalog.length}] processed | ${(totalBytes / 1e6).toFixed(1)} MB total | ${totalTris.toLocaleString()} tris`,
      );
    }
  }

  manifest.sort((a, b) => a.zone.localeCompare(b.zone) || a.subgroup.localeCompare(b.subgroup) || a.name.localeCompare(b.name));
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `\nDebranded & optimized ${manifest.length} models in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
  console.log(
    `Total output: ${(totalBytes / 1e6).toFixed(1)} MB | ${totalTris.toLocaleString()} triangles (avg ${Math.round(totalTris / Math.max(1, manifest.length)).toLocaleString()} tris/model)`,
  );
}

await main();
