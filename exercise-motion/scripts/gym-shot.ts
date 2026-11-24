#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = join(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "dist", "gym");

interface ShotSpec {
  out: string;
  hash: string;
  width?: number;
  height?: number;
}

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
    await new Promise<void>((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("CDP WebSocket error")), { once: true });
    });
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

export async function captureGymShots(specs: ShotSpec[]): Promise<void> {
  if (!existsSync(join(OUT_DIR, "index.html"))) {
    throw new Error("Missing dist/gym/index.html — run `bun exercise-motion/scripts/gym-build.ts` first.");
  }

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const p = new URL(req.url).pathname;
      const rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
      const file = Bun.file(join(OUT_DIR, rel));
      if (!(await file.exists())) return new Response("Not Found", { status: 404 });
      const headers: Record<string, string> = {};
      if (rel.endsWith(".glb")) headers["Content-Type"] = "model/gltf-binary";
      else if (rel.endsWith(".html")) headers["Content-Type"] = "text/html; charset=utf-8";
      return new Response(file, { headers });
    },
  });

  const debugPort = 19222 + Math.floor(Math.random() * 5000);
  const userDataDir = `/tmp/gym-chrome-${process.pid}-${Date.now()}`;
  mkdirSync(userDataDir, { recursive: true });

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
    { stdout: "ignore", stderr: "pipe" },
  );

  try {
    // Wait for DevTools JSON endpoint
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

    let fullGymLoaded = false;

    for (const spec of specs) {
      const width = spec.width ?? 1440;
      const height = spec.height ?? 900;
      await cdp.call("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });

      const isInspectOnly = /(?:^|&)inspect=/.test(spec.hash);
      if (fullGymLoaded) {
        // Reuse the already-loaded 283-model gym scene and instantaneously move camera / toggle inspector!
        await cdp.call("Runtime.evaluate", {
          expression: `window.__GYM_APPLY_HASH__(${JSON.stringify(spec.hash)})`,
          awaitPromise: true,
        });
        await cdp.call("Runtime.evaluate", {
          expression: "window.dispatchEvent(new Event('resize'))",
        });
      } else {
        const url = `http://127.0.0.1:${server.port}/#${spec.hash}`;
        await cdp.call("Page.navigate", { url });
        let ready = false;
        for (let i = 0; i < 600; i++) {
          const res = await cdp.call("Runtime.evaluate", {
            expression: "Boolean(window.__GYM_READY__)",
            returnByValue: true,
          });
          if (res?.result?.value === true) {
            ready = true;
            break;
          }
          await Bun.sleep(150);
        }
        if (!ready) {
          const progress = await cdp.call("Runtime.evaluate", {
            expression: "`${window.__GYM_LOADED__}/${window.__GYM_TOTAL__}`",
            returnByValue: true,
          });
          console.warn(`Warning: ${spec.out} timed out waiting for ready (${progress?.result?.value})`);
        }
        if (!isInspectOnly) fullGymLoaded = true;
      }

      // Let WebGL render 4 frames after resize/camera jump
      await cdp.call("Runtime.evaluate", {
        expression:
          "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))))",
        awaitPromise: true,
      });

      const shot = (await cdp.call("Page.captureScreenshot", { format: "png" })) as { data: string };
      writeFileSync(spec.out, Buffer.from(shot.data, "base64"));
      console.log(`Captured ${spec.out} (${width}x${height})`);
    }
    cdp.close();
  } finally {
    chrome.kill();
    server.stop();
    await Bun.spawn(["rm", "-rf", userDataDir]).exited;
  }
}

if (import.meta.main) {
  const [out, hash = "zone=overview", size = "1440,900"] = process.argv.slice(2);
  if (!out) {
    throw new Error('Usage: gym-shot.ts <out.png> ["zone=overview"] [width,height]');
  }
  const [w, h] = size.split(",").map(Number);
  await captureGymShots([{ out, hash, width: w || 1440, height: h || 900 }]);
}
