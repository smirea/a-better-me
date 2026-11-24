#!/usr/bin/env bun
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GATEKEEPER_URL = "https://gatekeeper.eaiws.pcon-solutions.com/v2/session/60e7fc72e2f83";
const ROOT = join(import.meta.dir, "..");
const CACHE_DIR = join(ROOT, ".cache", "gym");
const RAW_DIR = join(CACHE_DIR, "raw");

export interface RawCatalogItem {
  id: string;
  base: string;
  pkg: string;
  label: string;
  line: string;
  trail: string[];
  varCode: string;
  varCodeType: string;
}

interface Session {
  server: string;
  sessionId: string;
}

async function openSession(): Promise<Session> {
  const res = await fetch(GATEKEEPER_URL);
  if (!res.ok) throw new Error(`Gatekeeper HTTP ${res.status}`);
  const data = (await res.json()) as { server?: string; sessionId?: string };
  if (!data.server || !data.sessionId) throw new Error("Gatekeeper returned invalid session");
  return { server: data.server, sessionId: data.sessionId };
}

async function soap(session: Session, service: "Catalog" | "Basket", body: string): Promise<string> {
  const res = await fetch(`${session.server}EAI/${service}`, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`,
  });
  return res.text();
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(base: string): string {
  return base
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

interface CatalogNode {
  type: string;
  name: string;
  base: string;
  pkg: string;
  varCode: string;
  varCodeType: string;
  label: string;
}

async function listItems(session: Session, paths: string[]): Promise<CatalogNode[]> {
  const xml = await soap(
    session,
    "Catalog",
    `<listCatalogItems xmlns="http://catalog.ws.eai.egr/"><sessionId xmlns="">${session.sessionId}</sessionId>${paths
      .map((p) => `<path xmlns="">${escapeXml(p)}</path>`)
      .join("")}</listCatalogItems>`,
  );
  return [...xml.matchAll(/<return\s+([^>]+)>(.*?)<\/return>/gs)].map((match) => {
    const attrs = match[1];
    const inner = match[2];
    const attr = (key: string) =>
      decodeXml(attrs.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`))?.[1] ?? "");
    const label = decodeXml(inner.match(/<label>([^<]*)<\/label>/)?.[1] ?? "");
    return {
      type: attr("type"),
      name: attr("name"),
      base: attr("baseArticleNumber"),
      pkg: attr("articlePackageId") || "::tgym::tgym::1/ANY",
      varCode: attr("variantCode"),
      varCodeType: attr("varCodeType"),
      label,
    };
  });
}

async function enumerateCatalog(session: Session): Promise<RawCatalogItem[]> {
  const seen = new Set<string>();
  const items: RawCatalogItem[] = [];

  async function walk(paths: string[], trail: string[]) {
    const nodes = await listItems(session, paths);
    for (const node of nodes) {
      if (node.type === "Folder") {
        await walk([...paths, node.name], [...trail, node.label]);
      } else if (node.type === "Article" && node.base) {
        if (seen.has(node.base)) continue;
        seen.add(node.base);
        items.push({
          id: slugify(node.base),
          base: node.base,
          pkg: node.pkg,
          label: node.label,
          line: trail[1] ?? trail[0] ?? "Equipment",
          trail,
          varCode: node.varCode,
          varCodeType: node.varCodeType,
        });
      }
    }
  }

  await walk(["tgym:0", "catalogtgym:@Technogym$default"], ["Catalog"]);
  return items;
}

function isValidGlb(path: string): boolean {
  if (!existsSync(path)) return false;
  const size = statSync(path).size;
  if (size < 1024) return false;
  return true;
}

async function exportArticle(session: Session, item: RawCatalogItem): Promise<Buffer> {
  const insertXml = await soap(
    session,
    "Basket",
    `<insertOFMLArticle xmlns="http://basket.ws.eai.egr/"><sessionId xmlns="">${session.sessionId}</sessionId><fatherId xmlns=""></fatherId><beforeId xmlns=""></beforeId><insertInfo xmlns=""><articlePackageId>${escapeXml(item.pkg)}</articlePackageId><baseArticleNumber>${escapeXml(item.base)}</baseArticleNumber>${item.varCode ? `<variantCode>${escapeXml(item.varCode)}</variantCode>` : ""}</insertInfo></insertOFMLArticle>`,
  );
  const itemId = insertXml.match(/<return>([^<]+)<\/return>/)?.[1];
  if (!itemId) {
    throw new Error(`insertOFMLArticle failed for ${item.base}: ${insertXml.slice(0, 240)}`);
  }

  const exportXml = await soap(
    session,
    "Basket",
    `<getExportedGeometry xmlns="http://basket.ws.eai.egr/"><sessionId xmlns="">${session.sessionId}</sessionId><itemId xmlns="">${escapeXml(itemId)}</itemId><options xmlns="">format=GLTF</options></getExportedGeometry>`,
  );
  const url = exportXml.match(/<return>(https?:\/\/[^<]+)<\/return>/)?.[1];
  if (!url) {
    throw new Error(`getExportedGeometry failed for ${item.base}: ${exportXml.slice(0, 240)}`);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GLB download HTTP ${res.status} for ${item.base}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 4).toString("ascii") !== "glTF") {
    throw new Error(`Downloaded non-GLB payload for ${item.base}`);
  }

  // Keep the remote session basket light.
  await soap(
    session,
    "Basket",
    `<deleteItems xmlns="http://basket.ws.eai.egr/"><sessionId xmlns="">${session.sessionId}</sessionId><itemIds xmlns="">${escapeXml(itemId)}</itemIds></deleteItems>`,
  ).catch(() => {});

  return buf;
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  const catalogPath = join(CACHE_DIR, "catalog.json");
  const refresh = process.argv.includes("--refresh-catalog");

  let catalog: RawCatalogItem[];
  if (!refresh && existsSync(catalogPath)) {
    catalog = (await Bun.file(catalogPath).json()) as RawCatalogItem[];
    console.log(`Loaded cached catalog: ${catalog.length} unique models`);
  } else {
    console.log("Enumerating 3D equipment catalog...");
    const session = await openSession();
    catalog = await enumerateCatalog(session);
    await Bun.write(catalogPath, JSON.stringify(catalog, null, 2));
    console.log(`Saved ${catalog.length} unique models to ${catalogPath}`);
  }

  const pending = catalog.filter((item) => !isValidGlb(join(RAW_DIR, `${item.id}.glb`)));
  console.log(
    `Already cached: ${catalog.length - pending.length} | To fetch: ${pending.length}`,
  );
  if (pending.length === 0) return;

  const workers = Math.min(8, pending.length);
  let cursor = 0;
  let done = catalog.length - pending.length;
  let totalBytes = 0;
  const failures: { id: string; base: string; error: string }[] = [];

  await Promise.all(
    Array.from({ length: workers }, async () => {
      let session = await openSession();
      while (true) {
        const index = cursor++;
        if (index >= pending.length) break;
        const item = pending[index];
        const outPath = join(RAW_DIR, `${item.id}.glb`);

        let ok = false;
        let lastError = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) session = await openSession();
            const buf = await exportArticle(session, item);
            await Bun.write(outPath, buf);
            totalBytes += buf.length;
            ok = true;
            break;
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
        done++;
        if (ok) {
          if (done % 10 === 0 || done === catalog.length) {
            console.log(
              `[${done}/${catalog.length}] fetched (${(totalBytes / 1e6).toFixed(1)} MB new) — latest: ${item.label}`,
            );
          }
        } else {
          failures.push({ id: item.id, base: item.base, error: lastError });
          console.error(`[${done}/${catalog.length}] FAILED ${item.base}: ${lastError}`);
        }
      }
    }),
  );

  console.log(
    `\nFetch complete: ${catalog.length - failures.length}/${catalog.length} cached in ${RAW_DIR}`,
  );
  if (failures.length) {
    await Bun.write(join(CACHE_DIR, "fetch-failures.json"), JSON.stringify(failures, null, 2));
    console.error(`${failures.length} failures written to fetch-failures.json`);
  }
}

await main();
