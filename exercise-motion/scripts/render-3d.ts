#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { analyze } from "../src/biomech";
import { groupsOf } from "../src/catalog";
import { generate, kinematics } from "../src/exercise";
import type { Muscle } from "../src/muscles";
import { DEFAULT_SKIN_ID } from "../src/skin";
import { runChecks } from "../src/validate";
import { loadAppCatalog, loadSpec, MOTION_ROOT } from "./catalog-io";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EXTRA_GYM_MODELS = process.env.GYM_MODELS_DIR ?? "";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
};

class CdpClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: any; error?: any };
      if (msg.id == null) return;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
      else entry.resolve(msg.result);
    });
  }

  async open(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((res, rej) => {
      this.ws.addEventListener("open", () => res(), { once: true });
      this.ws.addEventListener("error", () => rej(new Error("CDP WebSocket error")), { once: true });
    });
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flagValue = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const VALUE_FLAGS = new Set(["--out", "--views", "--setting", "--skin"]);
  const slug = args.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1] ?? ""));
  if (!slug) {
    throw new Error(
      "Usage: render-3d.ts <slug> [--out /tmp/render-3d.png] [--views Side,Angle,Front] [--setting studio-light] [--skin studio-graphite] [--closeups]",
    );
  }
  const outPng = flagValue("--out") ?? `/tmp/motion-inspect/3d-${slug}.png`;
  const views = (flagValue("--views") ?? "Side,Angle,Front").split(",");
  const setting = flagValue("--setting") ?? "studio-light";
  const skin = flagValue("--skin") ?? DEFAULT_SKIN_ID;
  const closeups = args.includes("--closeups");

  const spec = await loadSpec(slug);
  const catalog = loadAppCatalog();
  const entry = catalog.find((e) => e.id === spec.catalogId);
  if (!entry) throw new Error(`Unknown catalogId ${spec.catalogId}`);

  const { body, built, sequence } = generate(spec);
  const kin = kinematics(body, sequence);
  const analysis = analyze(body, sequence, kin);
  const checks = runChecks(body, built, sequence, kin);
  const stretched = groupsOf(entry.selection?.stretchedMuscles ?? []);
  const mean = (muscles: Muscle[]) =>
    muscles.length
      ? muscles.reduce((sum, m) => sum + analysis.peak[m].activation, 0) / muscles.length
      : 0;
  const itemData = {
    sequence,
    checks,
    catalog: { primary: entry.primaryMuscles, secondary: entry.secondaryMuscles, stretched },
    agreement: {
      listedInTop: 0,
      listed: entry.primaryMuscles.length + entry.secondaryMuscles.length,
      primaryMean: mean(entry.primaryMuscles),
      secondaryMean: mean(entry.secondaryMuscles),
      otherMean: 0,
      unexpected: [] as Muscle[],
      stretchedFound: 0,
      stretched: stretched.length,
    },
    faults: [],
    images: [],
  };

  const bundle = await Bun.build({
    entrypoints: [join(MOTION_ROOT, "viewer/main.ts")],
    minify: true,
    target: "browser",
  });
  if (!bundle.success) throw new AggregateError(bundle.logs, "Viewer bundle failed");
  const script = (await bundle.outputs[0].text()).replaceAll("</script", "<\\/script");
  const style =
    (await Bun.file(join(MOTION_ROOT, "viewer/style.css")).text()) +
    (await Bun.file(join(MOTION_ROOT, "viewer/page.css")).text());
  const html = (await Bun.file(join(MOTION_ROOT, "viewer/index.html")).text())
    .replace("/*STYLE*/", () => style)
    .replace("__DATA__", () => JSON.stringify({ mode: "library" }))
    .replace("__LIFTER__", () => "")
    .replace("__MUSCLE_MAP__", () => "")
    .replace("/*SCRIPT*/", () => script);

  const summary = [
    {
      id: sequence.id,
      catalogId: sequence.catalogId,
      name: sequence.name,
      alternativeNames: entry.alternativeNames,
      category: entry.category,
      movementPattern: entry.movementPatterns[0] ?? "Other",
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
      equipmentLabel: entry.resistanceEquipment[0] ?? "Bodyweight",
      issueCount: 0,
      checksPass: checks.filter((c) => c.pass).length,
      checksTotal: checks.length,
    },
  ];

  const customModelsDir = join(MOTION_ROOT, "models");
  const localGymModelsDir = join(MOTION_ROOT, "dist", "gym", "models");
  const assetsDir = join(MOTION_ROOT, "viewer", "assets");

  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const pathname = decodeURIComponent(new URL(req.url).pathname);
      if (pathname === "/" || pathname === "/index.html") {
        return new Response(html, { headers: { "content-type": MIME[".html"] } });
      }
      if (pathname === "/catalog.json") {
        return new Response(JSON.stringify(summary), { headers: { "content-type": MIME[".json"] } });
      }
      if (pathname === `/sequences/${sequence.id}.json`) {
        return new Response(JSON.stringify(itemData), { headers: { "content-type": MIME[".json"] } });
      }
      if (pathname === "/lifter.bin" || pathname === "/muscle-map.png") {
        const p = join(assetsDir, pathname.slice(1));
        return new Response(Bun.file(p), { headers: { "content-type": MIME[extname(p)] } });
      }
      if (pathname.startsWith("/gym-models/")) {
        const safe = normalize(pathname.slice("/gym-models/".length))
          .replace(/^(\.\.[/\\])+/, "")
          .replace(/^\/+/, "");
        const dirs = [customModelsDir, localGymModelsDir, ...(EXTRA_GYM_MODELS ? [EXTRA_GYM_MODELS] : [])];
        for (const dir of dirs) {
          const candidate = join(dir, safe);
          if (existsSync(candidate)) {
            return new Response(Bun.file(candidate), { headers: { "content-type": MIME[".glb"] } });
          }
        }
      }
      return new Response("Not found", { status: 404 });
    },
  });

  const tmpDir = `/tmp/motion-inspect/_render3d_${process.pid}_${Date.now()}`;
  const userDataDir = join(tmpDir, "chrome");
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(join(outPng, ".."), { recursive: true });

  const debugPort = 24222 + Math.floor(Math.random() * 5000);
  const chrome = Bun.spawn(
    [
      CHROME,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );

  const total = sequence.poses.length;
  const peak = sequence.phases[1]?.from ?? Math.floor(total / 2);
  const mid = Math.floor(peak / 2);
  const frames: [label: string, idx: number][] = [
    ["start", 0],
    ["mid", mid],
    ["peak", peak],
  ];

  try {
    let pageWs = "";
    for (let i = 0; i < 60; i++) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as {
          type: string;
          webSocketDebuggerUrl?: string;
        }[];
        const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page?.webSocketDebuggerUrl) {
          pageWs = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await Bun.sleep(100);
    }
    if (!pageWs) throw new Error("Timed out waiting for headless Chrome CDP");

    const cdp = new CdpClient(pageWs);
    await cdp.open();
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", {
      width: 900,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const url = `http://127.0.0.1:${server.port}/#id=${encodeURIComponent(sequence.id)}&clean=1&setting=${encodeURIComponent(setting)}&skin=${encodeURIComponent(skin)}&play=0&view=${views[0]}&frame=0`;
    await cdp.call("Page.navigate", { url });
    for (let i = 0; i < 120; i++) {
      const res = await cdp.call("Runtime.evaluate", {
        expression: "Boolean(window.__MOTION_READY__ && window.__MOTION_SET__)",
        returnByValue: true,
      });
      if (res?.result?.value === true) break;
      await Bun.sleep(100);
    }

    const font = "/System/Library/Fonts/Helvetica.ttc";
    const captureTile = async (
      setOpts: Record<string, unknown>,
      tag: string,
      caption: string,
    ): Promise<string> => {
      await cdp.call("Runtime.evaluate", {
        expression: `window.__MOTION_SET__(${JSON.stringify(setOpts)})`,
        awaitPromise: true,
      });
      await cdp.call("Runtime.evaluate", {
        expression:
          "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))",
        awaitPromise: true,
      });
      const shot = (await cdp.call("Page.captureScreenshot", { format: "png" })) as { data: string };
      const raw = join(tmpDir, `${tag}.png`);
      writeFileSync(raw, Buffer.from(shot.data, "base64"));
      const labeled = join(tmpDir, `${tag}-lbl.png`);
      if (existsSync(font)) {
        await $`magick ${raw} -gravity NorthWest -fill "#000000aa" -draw "rectangle 0,0,260,26" -font ${font} -fill white -pointsize 15 -annotate +8+5 ${caption} ${labeled}`.quiet();
        return labeled;
      }
      return raw;
    };

    const rowPngs: string[] = [];
    for (const view of views) {
      const tiles: string[] = [];
      for (const [label, frameIdx] of frames) {
        tiles.push(
          await captureTile(
            { view, frame: frameIdx, focus: "full" },
            `${view}-${label}`,
            `${view} - ${label} (f${frameIdx})`,
          ),
        );
      }
      const row = join(tmpDir, `row-${view}.png`);
      await $`magick ${tiles} +append ${row}`.quiet();
      rowPngs.push(row);
    }

    if (closeups) {
      // Each hand gets its own tile at a fixed close distance, so finger wrap reads even when the hands are far apart.
      for (const [label, frameIdx] of [["start", 0], ["peak", peak]] as const) {
        const cuTiles = [
          await captureTile({ view: "Angle", frame: frameIdx, focus: "handL" }, `closeup-handL-${label}`, `Left hand - ${label} (f${frameIdx})`),
          await captureTile({ view: "Angle", frame: frameIdx, focus: "handR" }, `closeup-handR-${label}`, `Right hand - ${label} (f${frameIdx})`),
          await captureTile({ view: "Side", frame: frameIdx, focus: "feet" }, `closeup-feet-${label}`, `Feet - ${label} (f${frameIdx})`),
        ];
        const cuRow = join(tmpDir, `row-closeups-${label}.png`);
        await $`magick ${cuTiles} +append ${cuRow}`.quiet();
        rowPngs.push(cuRow);
      }
    }

    await $`magick ${rowPngs} -append ${outPng}`.quiet();
    cdp.close();
    console.log(outPng);
  } finally {
    chrome.kill();
    server.stop(true);
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

await main();
